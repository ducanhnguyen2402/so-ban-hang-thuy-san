# Sổ Bán Hàng Thủy Sản (PWA)

Ứng dụng web di động thay thế sổ tay giấy cho tiểu thương bán thủy sản sống ngoài chợ (cua, ốc, ngao, trạch, lươn...).

## Tính năng chính
- **Ghi đơn nhanh (< 10 giây):** chọn khách quen hoặc thêm nhanh khách mới, bấm chọn mặt hàng, tự quy đổi `kg` / `lạng` / `g` / `yến` sang `kg`, chọn **Trả đủ / Trả 1 phần / Ghi nợ**.
- **Sổ đơn trong ngày:** xem chi tiết, sửa đơn, xóa đơn (có xác nhận), chuyển ngày xem lại.
- **Công nợ:** xếp hạng khách nợ từ nhiều đến ít, xem từng đơn nợ và ghi nhận khách trả tiền từng phần nhiều lần.
- **Nhập hàng:** ghi nhanh mặt hàng, số lượng (hỗ trợ đổi đơn vị), tiền vốn theo ngày.
- **Tổng kết ngày:** Doanh thu, Tiền đã thu trong ngày, Nợ phát sinh, Vốn nhập, Lời/Lỗ (xanh khi lời, đỏ khi lỗ) theo múi giờ Việt Nam.
- **Bảo mật từng cửa hàng:** bật Row Level Security (`auth.uid() = user_id`) trên toàn bộ bảng Supabase Postgres.

## Cài đặt & chạy trên máy
1. Cài đặt thư viện:
   ```bash
   npm install
   ```
2. Tạo bảng & RLS trên Supabase: chạy toàn bộ nội dung file `supabase/schema.sql` trong **SQL Editor** của Supabase.
3. Tạo file `.env.local` từ `.env.example` và điền thông tin Supabase:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```
4. Chạy thử:
   ```bash
   npm run dev
   ```
5. Kiểm tra kiểu & đóng gói production:
   ```bash
   npm run typecheck
   npm run build
   ```

## Đưa lên mạng miễn phí (Vercel) & Cài lên điện thoại (PWA)
1. Đưa mã nguồn lên GitHub (file `.env.local` đã được `.gitignore` bỏ qua).
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → chọn repo vừa tạo.
3. Trong mục **Environment Variables**, thêm 2 biến:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Bấm **Deploy** để nhận đường dẫn `https://...vercel.app`.
5. **Thêm vào màn hình chính điện thoại:**
   - **iPhone (Safari):** mở link app → bấm nút **Chia sẻ (Share)** ở dưới → chọn **Thêm vào MH chính (Add to Home Screen)**.
   - **Android (Chrome):** mở link app → bấm dấu **⋮** ở góc trên phải → chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.
