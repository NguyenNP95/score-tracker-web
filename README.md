# Score Tracker (web)

Bảng ghi điểm các ván chơi, bản web của app Android Score Tracker. HTML/CSS/JS thuần, không cần build, chạy được offline và cài lên màn hình chính như app (PWA).

## Tính năng

- Mỗi ván tổng bằng 0: nhập đến ô cuối cùng còn trống thì ô đó **tự điền** (chữ xanh).
- Ván đã nhập đủ mà tổng khác 0 được **tô vàng** để cảnh báo.
- Hàng **Tổng**: số dương xanh, số âm đỏ, người dẫn đầu được làm nổi bật.
- **Bàn phím số riêng** có dấu trừ (bàn phím số của iPhone không có). Nút **Tiếp** nhảy sang ô trống kế tiếp, hết ván thì sang ván sau.
- Tự thêm hàng khi nhập đến hàng cuối. Thêm/bớt người chơi, bấm vào tên để đổi tên.
- **Chơi lại từ đầu**: bảng cũ được lưu vào **Lịch sử** (giữ hoặc xóa tên người chơi).
- **Lịch sử**: xem lại (chỉ xem), xuất Excel, xóa từng lần hoặc xóa hết.
- **Xuất Excel** (.xlsx, có hàng Tổng), mở menu chia sẻ của máy hoặc tải file về.
- Giữ màn hình sáng khi đang mở app (nếu trình duyệt hỗ trợ).
- Chế độ sáng/tối theo máy.

Dữ liệu chỉ lưu trên máy (localStorage của trình duyệt), không gửi đi đâu.

## Chạy thử trên máy

Cần mở qua một web server (mở trực tiếp file `index.html` sẽ không chạy vì dùng ES module):

```bash
python -m http.server 8000
```

Rồi mở http://localhost:8000.

## Deploy lên GitHub Pages (miễn phí)

1. Tạo repo mới trên GitHub, push toàn bộ thư mục này lên nhánh `main`.
2. Vào **Settings → Pages**, mục **Build and deployment** chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, bấm **Save**.
3. Sau khoảng 1 phút, app có ở `https://<tên-github>.github.io/<tên-repo>/`.

### Cập nhật phiên bản mới

App lưu sẵn file để chạy offline. Sau khi push bản mới, **tăng `VERSION` trong `sw.js`** (vd `v1` → `v2`). Người dùng mở app lần đầu sau đó vẫn thấy bản cũ, lần mở tiếp theo sẽ là bản mới.

Thêm/bớt file thì nhớ cập nhật danh sách `ASSETS` trong `sw.js`.

## Cài lên màn hình chính

- **iPhone/iPad (Safari)**: nút Chia sẻ → **Thêm vào MH chính**.
  Nên cài: nếu chỉ mở bằng Safari và lâu không dùng (khoảng 7 ngày), Safari có thể tự xóa dữ liệu của trang.
- **Android (Chrome)**: menu ⋮ → **Cài đặt ứng dụng** / **Thêm vào màn hình chính**.

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | Khung giao diện, bộ icon SVG |
| `css/style.css` | Giao diện, màu sáng/tối |
| `js/model.js` | Luật bảng điểm (giống hệt bản Android) |
| `js/storage.js` | Lưu bảng đang chơi và lịch sử |
| `js/grid.js` | Vẽ bảng điểm |
| `js/xlsx.js` | Tạo file Excel (tự viết, không cần thư viện ngoài) |
| `js/ui.js` | Hộp thoại, thông báo, định dạng ngày giờ |
| `js/app.js` | Điều khiển chính: bàn phím số, các màn hình, điều hướng |
| `sw.js`, `manifest.webmanifest` | Chạy offline, cài như app |
