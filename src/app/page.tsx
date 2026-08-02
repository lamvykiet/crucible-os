export default function Home() {
  return (
    <div>
      <h1 className="c-card-title" style={{ fontSize: '32px' }}>Welcome to Crucible OS</h1>
      <p className="c-card-body mt-2">
        Hệ điều hành cá nhân - Tích hợp Knowledge, Learning và Finance.
      </p>

      <div className="mt-8 flex gap-4">
        <div className="c-card" style={{ flex: 1 }}>
          <div className="c-card-kicker">Knowledge Hub</div>
          <h2 className="c-card-title">0 Mục quá hạn</h2>
          <p className="c-card-body">Bạn đã đọc hết các tài liệu lưu trữ.</p>
          <div className="mt-4">
            <button className="c-btn c-btn-primary c-btn-sm">Xem tài liệu</button>
          </div>
        </div>

        <div className="c-card" style={{ flex: 1 }}>
          <div className="c-card-kicker">Finance OS</div>
          <h2 className="c-card-title">+1.250.000 ₫</h2>
          <p className="c-card-body">Số dư tháng này.</p>
          <div className="mt-4">
            <button className="c-btn c-btn-secondary c-btn-sm">Sổ chi tiêu</button>
          </div>
        </div>
      </div>
    </div>
  );
}
