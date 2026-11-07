# anti47 — GPSService.ts: Bài 1

**Chủ đề:** Imports, class, state, constructor, callback types, singleton  
**Đối tượng:** Developer đã quen Erlang, đang học TypeScript / React Native  
**Nguồn:** File `GPSService.ts` do bạn cung cấp (164 dòng).  
**Phạm vi:** Dòng 9–33, 163–164; các ví dụ bổ sung được ghi rõ.

## 1. GPSService đóng vai trò gì?

Theo phần mô tả đầu file, service phối hợp theo dõi GPS thực (`expo-location`) và tuyến đường mô phỏng; giữ trạng thái telemetry; đưa vị trí thô qua `GPSFilter`; phát các cập nhật đã xử lý cho UI và thành phần khác.

Luồng tổng quát:

```text
App.tsx (UI)
    | gọi start/stop, subscribe
    v
GPSService
    |--> expo-location (GPS thật)
    |--> GPSSimulator (dữ liệu mô phỏng)
    |--> GPSFilter (xử lý vị trí thô)
    `--> callbacks (đẩy cập nhật cho UI)
```

Liên hệ Erlang: `GPSService` có trách nhiệm quản lý trạng thái giống một phần công việc của `gen_server`, nhưng **class TypeScript không tự tạo process, mailbox hay process isolation**.

## 2. Imports (dòng 9–18)

```typescript
import * as Location from 'expo-location';
import {
  DEFAULT_GPS_FILTER_CONFIG,
  GPSFilterConfig,
  GPSFix,
  GPSStatus,
  RawLocationData,
} from '../../types/gps';
import { processRawLocation } from './GPSFilter';
import { GPSSimulator } from './GPSSimulator';
```

- `import * as Location` gom các export vào namespace `Location`, nên có thể gọi `Location.watchPositionAsync(...)`.
- `GPSFix`, `GPSStatus`, `GPSFilterConfig`, `RawLocationData` được dùng như kiểu dữ liệu trong file này. Ta cần mở `types/gps` để biết cấu trúc chính xác.
- `processRawLocation` là function được import từ GPSFilter.
- `GPSSimulator` là class được import để tạo simulator.

**Khác với Erlang:** `-export([...])` xác định hàm module cung cấp; TypeScript `import` lấy export từ module khác và `export` cung cấp chúng cho module khác.

## 3. Class và các thuộc tính (dòng 20–28)

```typescript
export class GPSService {
  private status: GPSStatus = 'idle';
  private currentFix: GPSFix | null = null;
  private filterConfig: GPSFilterConfig;
  private simulator: GPSSimulator;
  private locationSubscription: Location.LocationSubscription | null = null;

  private fixSubscribers = new Set<(fix: GPSFix) => void>();
  private statusSubscribers = new Set<(status: GPSStatus) => void>();
```

### Đọc một khai báo thuộc tính

`private status: GPSStatus = 'idle'`:

- `private`: TypeScript kiểm tra việc truy cập chỉ từ bên trong class. Không phải cơ chế cách ly như state của Erlang process.
- `status`: tên thuộc tính.
- `GPSStatus`: kiểu thuộc tính (định nghĩa chi tiết ở file khác).
- `'idle'`: giá trị ban đầu.

### Union type và null

`private currentFix: GPSFix | null = null` cho phép thuộc tính chứa `GPSFix` **hoặc** `null`.

```typescript
if (this.currentFix !== null) {
  // TypeScript có thể hiểu currentFix là GPSFix trong nhánh này.
}
```

Khái niệm này gọi là **type narrowing**.

### Subscription handle

`locationSubscription` chứa handle do Expo Location trả về, hoặc `null` khi chưa có subscription. Về sau `stopTracking()` gọi `remove()` để dừng theo dõi.

## 4. Callback type và Set (dòng 27–28)

```typescript
private fixSubscribers = new Set<(fix: GPSFix) => void>();
```

Đọc từ trong ra ngoài:

1. `(fix: GPSFix) => void` là kiểu function nhận một `GPSFix`, không trả về giá trị hữu ích.
2. `Set<...>` là tập hợp các function có kiểu như vậy.
3. `new Set<...>()` tạo tập hợp rỗng.

**Ví dụ minh họa (không phải code gốc):**

```typescript
const listeners = new Set<(speed: number) => void>();
const logSpeed = (speed: number) => console.log('Speed:', speed);

listeners.add(logSpeed);
for (const listener of listeners) {
  listener(60);
}
listeners.delete(logSpeed);
```

Kết quả: `Speed: 60`.

`Set` tránh thêm trùng **cùng một function reference**; hai callback khác reference dù có nội dung giống nhau vẫn được tính là hai phần tử.

So với Erlang: thay vì gửi `Pid ! Message`, JavaScript thường gọi callback trực tiếp. Callback không phải một process độc lập.

## 5. Constructor (dòng 30–33)

```typescript
constructor(config: GPSFilterConfig = DEFAULT_GPS_FILTER_CONFIG) {
  this.filterConfig = config;
  this.simulator = new GPSSimulator();
}
```

Khi gọi `new GPSService()`, constructor chạy để:

1. Nhận `config`, dùng `DEFAULT_GPS_FILTER_CONFIG` nếu không truyền đối số.
2. Gán cấu hình vào `this.filterConfig`.
3. Tạo `GPSSimulator` riêng cho instance.

`this` tham chiếu đến instance đang được thao tác. Có thể liên tưởng constructor với bước khởi tạo state trong `gen_server:init/1`, nhưng constructor chạy đồng bộ khi tạo object, không chạy trong một BEAM process riêng.

## 6. Instance dùng chung ở cuối file (dòng 163–164)

```typescript
// Global singleton instance for shared usage
export const gpsService = new GPSService();
```

Các module có thể import cùng một instance:

```typescript
import { gpsService } from './GPSService';
```

Đây là **module-level shared instance** (thường gọi là singleton theo cách dùng), nhưng không ngăn code khác tạo `new GPSService()` vì class vẫn được export. Việc tạo instance cũng **không tự động bật GPS**.

## 7. Bài tập tự kiểm tra

1. `GPSFix | null` cho phép những giá trị nào?
2. `Set<(fix: GPSFix) => void>` lưu dữ liệu GPS hay lưu function?
3. Vì sao `private` không giống process isolation của Erlang?
4. `new GPSService()` có tự gọi `startLiveTracking()` không?
5. Điều gì xảy ra nếu hai callback khác nhau cùng được đăng ký?

**Đáp án gợi ý:**

1. Một `GPSFix` hoặc `null`.
2. Các function callback nhận `GPSFix`.
3. Vì class không tạo mailbox/process; `private` chủ yếu được TypeScript kiểm tra tĩnh.
4. Không; constructor chỉ gán config và tạo simulator.
5. Khi service phát fix, cả hai có thể được gọi.

## 8. Ghi chú code review cho các bài sau

- **Bài 2:** `subscribe()` trả về một function unsubscribe; kiểm tra lifecycle callback.
- **Bài 3–4:** `startLiveTracking()` chờ permission và `watchPositionAsync()`. Cần xem xét race condition nếu người dùng nhấn Stop trong lúc `await` chưa hoàn thành.
- **Bài 5:** `stopTracking()` dừng subscription và simulator nhưng không xóa `currentFix` — cần xác nhận UX mong muốn.
- **Bài 6:** Xem `setStatus()` / `notifyFix()` và các unit test.

## 9. Tài liệu nên mở song song

- `GPSService.ts` — nguồn chính của bài học.
- `src/types/gps` — định nghĩa `GPSFix`, `GPSStatus`, `GPSFilterConfig`.
- `GPSFilter.ts` — cách xử lý raw GPS fix.
- `GPSSimulator.ts` — mô phỏng dữ liệu GPS.
- `App.tsx` — nơi UI sử dụng service.

---

**Tiến độ:** Hoàn thành Bài 1/6. Bài tiếp theo: *Getter và Pub/Sub (dòng 35–59)*.
