// Used with router.param('id', ...): a non-numeric id can never match a row, so
// answer 404 up front instead of letting PostgreSQL fail the bigint cast (500).
export function validateIdParam(req, res, next, id) {
  if (!/^\d{1,18}$/.test(id)) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
}
