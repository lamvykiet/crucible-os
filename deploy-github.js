const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log("\n🚀 === CÔNG CỤ ĐẨY CODE LÊN GITHUB & VERCEL === 🚀\n");
  console.log("⚠️ Lưu ý: GitHub hiện KHÔNG CÒN hỗ trợ mật khẩu (password) thông thường để push code.");
  console.log("Bạn BẮT BUỘC phải sử dụng Personal Access Token (PAT).");
  console.log("Cách lấy PAT: Vào GitHub -> Settings -> Developer Settings -> Personal access tokens -> Tokens (classic) -> Generate new token.\n");

  const username = await question("1. Nhập username GitHub của bạn: ");
  if (!username) { console.log("Hủy thao tác."); process.exit(1); }

  const repo = await question("2. Nhập tên Repository (Ví dụ: crucible-os): ");
  if (!repo) { console.log("Hủy thao tác."); process.exit(1); }

  const token = await question("3. Nhập Personal Access Token (PAT): ");
  if (!token) { console.log("Hủy thao tác."); process.exit(1); }

  const remoteUrl = `https://${username}:${token}@github.com/${username}/${repo}.git`;

  try {
    console.log("\n⏳ Đang thiết lập remote 'origin'...");
    
    // Check if origin exists
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch(e) {
      // It's ok if it fails
    }

    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });
    
    console.log("\n⏳ Đang lưu lại các thay đổi mới nhất...");
    try {
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Auto commit before deploy"', { stdio: 'ignore' });
    } catch (e) {
      // Ignore if nothing to commit
    }
    
    console.log("\n⏳ Đang đẩy code lên GitHub...");
    execSync('git push -u origin HEAD --force', { stdio: 'inherit' });
    
    console.log("\n✅ ĐẨY CODE THÀNH CÔNG! Vercel sẽ tự động bắt đầu quá trình deploy.");
    console.log("Bạn có thể theo dõi tiến độ trên Dashboard của Vercel.");
  } catch (error) {
    console.log("\n❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH PUSH:");
    console.error(error.message);
    console.log("Vui lòng kiểm tra lại PAT hoặc Repo của bạn đã được tạo trên GitHub chưa.");
  } finally {
    // Remove token from remote for security
    try {
      console.log("\n🔒 Đang gỡ bỏ token khỏi remote để bảo mật...");
      execSync(`git remote set-url origin https://github.com/${username}/${repo}.git`, { stdio: 'ignore' });
    } catch(e) {}
    rl.close();
  }
}

main();
