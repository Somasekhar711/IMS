export const emptyProduct = {
  hsn: '',
  itemName: '',
  itemPrice: '',
  itemCategory: '',
  gst: '',
  discount: '',
  mfd: '',
  expiryDate: '',
  stockUpdatedDate: '',
  stockPresent: '',
  thresholdStock: '',
};

export const productFields = [
  { key: 'hsn', label: 'HSN', placeholder: 'e.g. 1905', type: 'text' },
  { key: 'itemName', label: 'Item name', placeholder: 'Product name', type: 'text' },
  { key: 'itemPrice', label: 'Item price', placeholder: '0.00', type: 'number' },
  { key: 'itemCategory', label: 'Item category', placeholder: 'e.g. Grocery', type: 'text' },
  { key: 'gst', label: 'GST%', placeholder: '0', type: 'number' },
  { key: 'discount', label: 'Discount%', placeholder: '0', type: 'number' },
  { key: 'mfd', label: 'MFD', type: 'date' },
  { key: 'expiryDate', label: 'Expiry date', type: 'date' },
  { key: 'stockUpdatedDate', label: 'Stock updated date', type: 'date' },
  { key: 'stockPresent', label: 'Stock present now', placeholder: '0', type: 'number' },
  { key: 'thresholdStock', label: 'Threshold stock', placeholder: '0', type: 'number' },
];
