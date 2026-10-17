// Nguồn duy nhất cho danh mục giao dịch (nhóm cha + danh mục con).
// Tên nhóm ở đây phải khớp với Transaction.categoryGroup và Budget.categoryGroup,
// vì dashboard và ngân sách cộng dồn theo đúng chuỗi tên này.

export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Housing",
  "Transportation",
  "Bills & Utilities",
  "Shopping",
  "Personal",
  "Entertainment",
  "Health & Fitness",
  "Assets & Equipment",
  "Other"
];

export const INCOME_CATEGORIES = ["Main Income", "Investment", "Business", "Gift", "Other Income"];

export const TRANSFER_CATEGORIES = ["Transfer Out", "Transfer In"];

// Groceries / Housing / Personal / Transportation / Main Income là nhóm đã có
// trong lịch sử giao dịch nhập từ
// Google Sheet, nên giữ nguyên tên thay vì đặt tên mới — nếu đổi tên thì mọi
// giao dịch cũ sẽ rơi ra ngoài biểu đồ và ô Ngân sách vs Thực chi.
// Quy ước "Assets & Equipment": món dùng trên 1 năm và trên ngưỡng 5 triệu
// (TV, máy lạnh, MacBook, máy in 3D, xe). Dưới ngưỡng đó để ở Shopping.
// Chi phí vận hành xe (xăng, bảo hiểm, bảo dưỡng, gửi xe) thuộc Transport,
// chỉ tiền mua xe mới vào Assets & Equipment > Vehicle.
export const SUB_CATEGORIES: Record<string, string[]> = {
  "Food & Dining": ["Breakfast", "Lunch", "Dinner", "Coffee", "Snacks"],
  "Groceries": ["Household Food", "Household Supplies"],
  "Housing": ["Rent", "Repairs"],
  "Transportation": ["Fuel", "Taxi", "Public Transit", "Parking", "Maintenance", "Insurance"],
  "Bills & Utilities": ["Electricity", "Water", "Internet", "Mobile & Data"],
  "Shopping": ["Clothing", "Electronics"],
  "Personal": [],
  "Entertainment": ["Movies", "Games", "Subscription"],
  "Health & Fitness": ["Medical", "Pharmacy", "Gym"],
  "Assets & Equipment": ["Home Appliances", "Work Equipment", "Personal Devices", "Vehicle"],
  "Main Income": ["Salary", "Bonus", "Allowance"],
  "Investment": ["Dividends", "Interest", "Capital Gains"],
  "Business": ["Sales", "Services"],
};

export function getCategories(type: string): string[] {
  if (type === "Income") return INCOME_CATEGORIES;
  if (type === "Transfer") return TRANSFER_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function getSubCategories(categoryGroup: string): string[] {
  return SUB_CATEGORIES[categoryGroup] ?? [];
}
