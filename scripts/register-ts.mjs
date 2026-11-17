// Cho `node` đọc thẳng các file src/lib/*.ts khi chạy test (không có test runner
// trong dự án). Node 24 tự bỏ kiểu TypeScript; file này chỉ dạy nó hai điều:
// "@/x" là "src/x", và đường dẫn không đuôi nghĩa là ".ts".
//
//   node --import ./scripts/register-ts.mjs scripts/test-budgets.mjs
import { register } from "node:module";
register("./ts-loader.mjs", import.meta.url);
