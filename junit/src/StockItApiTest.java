import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * JUnit 5 black-box tests for the StockIt REST API.
 *
 * The tests only speak HTTP, exactly like an outside client would, so they
 * verify the running system rather than its source code. The API address is
 * passed in with -Dstockit.api (see e2e/helpers/junit.js, which starts the
 * application on a fresh database, runs this class, and shuts it down again).
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("StockIt REST API (JUnit 5)")
class StockItApiTest {

    private static final String API = System.getProperty("stockit.api", "http://localhost:3100/api");
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final String EMAIL = "junit." + System.currentTimeMillis() + "@stockit.test";
    private static final String PASSWORD = "Stock@1234";

    private static String token;
    private static String productId;

    private static HttpResponse<String> send(String method, String path, String json, String bearer) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(API + path))
                .header("Content-Type", "application/json");
        if (bearer != null) {
            request.header("Authorization", "Bearer " + bearer);
        }
        request.method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    /** Pulls one value out of a flat JSON response, e.g. field(body, "token"). */
    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"?([^\",}]+)\"?").matcher(json);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String registrationBody(String email, String password) {
        return "{\"fullName\":\"JUnit Tester\",\"email\":\"" + email + "\",\"password\":\"" + password + "\","
                + "\"securityQuestion\":\"What city were you born in?\",\"securityAnswer\":\"Hyderabad\"}";
    }

    @BeforeAll
    static void registerAccount() throws Exception {
        HttpResponse<String> response = send("POST", "/auth/register", registrationBody(EMAIL, PASSWORD), null);
        assertEquals(201, response.statusCode(), "set-up: registration should succeed");
        token = field(response.body(), "token");
        assertNotNull(token, "set-up: registration should return a token");
    }

    @Test
    @Order(1)
    @DisplayName("JU-01 health endpoint reports the API is up")
    void healthCheck() throws Exception {
        HttpResponse<String> response = send("GET", "/health", null, null);
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"status\":\"ok\""));
    }

    @Test
    @Order(2)
    @DisplayName("JU-02 registering the same email twice is rejected with 409")
    void duplicateEmailIsRejected() throws Exception {
        HttpResponse<String> response = send("POST", "/auth/register", registrationBody(EMAIL, PASSWORD), null);
        assertEquals(409, response.statusCode());
    }

    @Test
    @Order(3)
    @DisplayName("JU-03 a weak password is rejected with 400")
    void weakPasswordIsRejected() throws Exception {
        HttpResponse<String> response = send("POST", "/auth/register",
                registrationBody("weak." + EMAIL, "password"), null);
        assertEquals(400, response.statusCode());
    }

    @Test
    @Order(4)
    @DisplayName("JU-04 login succeeds with the right password and fails with a wrong one")
    void login() throws Exception {
        String good = "{\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\"}";
        String bad = "{\"email\":\"" + EMAIL + "\",\"password\":\"Wrong@1234\"}";
        assertEquals(200, send("POST", "/auth/login", good, null).statusCode());
        assertEquals(401, send("POST", "/auth/login", bad, null).statusCode());
    }

    @Test
    @Order(5)
    @DisplayName("JU-05 protected endpoints refuse requests without a token")
    void productsRequireAuthentication() throws Exception {
        assertEquals(401, send("GET", "/products", null, null).statusCode());
        assertEquals(401, send("GET", "/products", null, "not.a.real.token").statusCode());
    }

    @Test
    @Order(6)
    @DisplayName("JU-06 a created product appears in the product list")
    void createProduct() throws Exception {
        String body = "{\"hsn\":\"JU-1001\",\"itemName\":\"JUnit Widget\",\"itemPrice\":50,\"stockPresent\":10,\"thresholdStock\":2}";
        HttpResponse<String> created = send("POST", "/products", body, token);
        assertEquals(201, created.statusCode());
        productId = field(created.body(), "id");
        assertNotNull(productId);

        HttpResponse<String> list = send("GET", "/products", null, token);
        assertEquals(200, list.statusCode());
        assertTrue(list.body().contains("JUnit Widget"));
    }

    @Test
    @Order(7)
    @DisplayName("JU-07 a negative price is rejected with 400")
    void negativePriceIsRejected() throws Exception {
        String body = "{\"hsn\":\"JU-1002\",\"itemName\":\"Broken\",\"itemPrice\":-5}";
        assertEquals(400, send("POST", "/products", body, token).statusCode());
    }

    @Test
    @Order(8)
    @DisplayName("JU-08 a sale reduces stock, and overselling is refused")
    void salesOrdersRespectStock() throws Exception {
        String sale = "{\"items\":[{\"productId\":" + productId + ",\"quantity\":4,\"unitPrice\":60}]}";
        assertEquals(201, send("POST", "/sales-orders", sale, token).statusCode());

        String oversell = "{\"items\":[{\"productId\":" + productId + ",\"quantity\":7,\"unitPrice\":60}]}";
        HttpResponse<String> refused = send("POST", "/sales-orders", oversell, token);
        assertEquals(400, refused.statusCode());
        assertTrue(refused.body().contains("6 available, 7 requested"));

        String products = send("GET", "/products", null, token).body();
        assertTrue(products.contains("\"stockPresent\":6"), "stock should be 10 - 4 = 6");
        assertFalse(products.contains("\"stockPresent\":-1"));
    }

    @Test
    @Order(9)
    @DisplayName("JU-09 the report summary totals the sale")
    void reportSummary() throws Exception {
        HttpResponse<String> response = send("GET", "/reports/summary?range=30", null, token);
        assertEquals(200, response.statusCode());
        assertEquals("240", field(response.body(), "salesTotal"));
        assertEquals("1", field(response.body(), "salesCount"));
    }
}
