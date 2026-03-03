# SongMinhDangKyThanhVien - Customer Registration App

App Angular standalone cho khách hàng tự đăng ký thành viên Song Minh qua Zalo hoặc nhập SĐT.

## Tech Stack
- Angular 19 standalone components
- No Angular Material (pure CSS)
- Shared layout CSS: `src/app/shared/layout.css`
- Deploy: Firebase Hosting (`songminh-dangky.web.app`)
- Backend: TapHoa39BackEnd (`taphoa39backend.onrender.com`)

## Routes (`app.routes.ts`)
| Path | Component | Muc dich |
|------|-----------|----------|
| `/` | LoginPageComponent | Trang chu - Login Zalo hoac chuyen sang complete-profile |
| `/complete-profile` | CompleteProfilePageComponent | Form nhap ten + SDT |
| `/card/:customer_code` | CardPageComponent | Hien thi the thanh vien + barcode |

## Registration Flow

### Flow 1: Zalo Login (co SĐT tu Zalo)
```
LoginPage → Zalo OAuth → callback code → exchangeCode()
  → Zalo tra ve {zalo_user_id, name, phone}
  → autoRegister(zaloUserId, name, phone)
  → POST /api/customer/register
  → navigate → /card/:code
```

### Flow 2: Zalo Login (khong co SĐT)
```
LoginPage → Zalo OAuth → callback → phone = null
  → navigate → /complete-profile
  → User nhap ten + SDT → onSubmit()
  → POST /api/customer/register
  → Neu moi (!res.existing): hien popup bonus 2s → navigate → /card/:code
  → Neu cu (res.existing): navigate thang → /card/:code
```

### Flow 3: Skip Zalo (nhap truc tiep)
```
LoginPage → click "Dang ky khong can Zalo"
  → navigate → /complete-profile
  → (giong Flow 2)
```

## Key Files

### Pages
- **login-page** (`pages/login-page/`): Zalo OAuth + auto-register. ViewState: `idle | loading | error`
- **complete-profile-page** (`pages/complete-profile-page/`): Form name + phone. ViewState: `form | loading | error | bonus`. Khi dang ky moi → hien popup "Tang 1000 diem" 2s truoc khi chuyen sang card
- **card-page** (`pages/card-page/`): Hien thi the thanh vien, barcode (JsBarcode CODE128), luu anh (html2canvas), copy + mo Zalo OA

### Services
- **RegistrationService** (`services/registration.service.ts`):
  - `register(name, phone, zaloUserId?)` → POST `/api/customer/register`
  - `getCard(code)` → GET `/api/customer/card/:code`
  - `saveCustomer(data)` / `getSavedCustomer()` → localStorage key `registered_customer`
  - `clearSavedCustomer()` → xoa localStorage

- **ZaloService** (`services/zalo.service.ts`):
  - `getLoginUrl()` → GET `/api/zalo/login` → tra OAuth URL
  - `exchangeCode(code)` → POST `/api/zalo/callback` → tra {zalo_user_id, name, phone}
  - Session luu trong `sessionStorage` key `zalo_session`

### Models (`models/customer-response.model.ts`)
```typescript
CustomerResponse { success, customer_code?, barcode_value?, name?, phone?, message?, existing? }
ZaloCallbackResponse { zalo_user_id, name, phone }
ZaloLoginResponse { oauth_url }
SavedCustomer { customer_code, barcode_value, name, phone }
ZaloSession { zalo_user_id, name, phone? }
```

## Backend Endpoints (TapHoa39BackEnd)

| Endpoint | Method | File | Muc dich |
|----------|--------|------|----------|
| `/api/customer/register` | POST | `routes/customer_registration.py` | Dang ky KH moi (check duplicate phone/zalo, tao KiotViet + Firestore) |
| `/api/customer/card/:code` | GET | `routes/customer_registration.py` | Lay thong tin KH theo Code |
| `/api/zalo/login` | GET | `routes/zalo_routes.py` | Lay Zalo OAuth URL |
| `/api/zalo/callback` | POST | `routes/zalo_routes.py` | Exchange Zalo code → user info |

## Anti-Spam / Duplicate Prevention
1. **Server-side phone check**: `_find_by_phone()` scan toan bo Firestore customers
2. **Zalo ID check**: `_find_by_zalo_id()` check trung Zalo account
3. **KiotViet enforce**: 1 SDT = 1 account
4. **Rate limiting**: `rate_limit_check(client_ip)` chong spam request
5. **Response `existing: true`**: Khi SDT da ton tai → tra ve KH cu, khong tao moi

## Registration Bonus (1000 diem)
- Backend: `data["RegistrationBonus"] = 1000` truoc khi luu Firestore (chi cho KH moi)
- Frontend: Popup "Tang 1000 diem cho khach hang dang ky lan dau!" hien 2s (chi khi `!res.existing`)
- POS (TapHoa39BanHang): `calculateGiftValue()` cong them `customer.RegistrationBonus` vao gift value

## Environment
- Dev: `apiUrl = http://127.0.0.1:5000`, port 4201
- Prod: `apiUrl = https://taphoa39backend.onrender.com`

## CSS Architecture
- `shared/layout.css`: Common styles (page-wrapper, card, form, buttons, spinner, error)
- Component-specific CSS: Overrides/additions (e.g. `.bonus-section` in complete-profile)
- No Angular Material, no external CSS framework
- Design: Glassmorphism card trên background video
