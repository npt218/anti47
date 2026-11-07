# GPSService.ts — Bài 3: Promise, async/await và GPS Permission

**Dự án:** anti47  
**Phạm vi:** `GPSService.ts`, dòng 61–74 (và liên hệ dòng 76–84)  
**Đối tượng:** Developer Erlang học TypeScript / React Native

## 1. Code gốc

```typescript
public async requestPermissions(): Promise<boolean> {
  this.setStatus('requesting_permission');
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.setStatus('permission_denied');
      return false;
    }
    return true;
  } catch {
    this.setStatus('error');
    return false;
  }
}
```

Hàm yêu cầu quyền truy cập vị trí khi ứng dụng ở foreground, cập nhật trạng thái của `GPSService` và trả kết quả thành công/thất bại.

## 2. `async` và `Promise<boolean>`

- `async` đánh dấu hàm bất đồng bộ: khi gọi, hàm luôn trả về một `Promise`.
- `Promise<boolean>` nghĩa là Promise khi *fulfilled* sẽ cho giá trị `true` hoặc `false`.
- Promise có ba trạng thái: **pending**, **fulfilled**, **rejected**.
- Promise không phải process/thread và không tự tạo concurrency giống Erlang process.

```typescript
async function getSpeed(): Promise<number> {
  return 60;
}

const pendingResult = getSpeed(); // Promise<number>
const speed = await getSpeed();    // number: 60 (trong async context)
```

**Liên hệ Erlang:** Có thể hình dung một worker gửi kết quả qua message, nhưng `await` đợi Promise được settle, còn `receive` đợi message khớp pattern trong mailbox của một process.

```erlang
Worker ! {get_speed, self()},
receive
    {speed, Speed} -> io:format("~p~n", [Speed])
end.
```

## 3. `await` và luồng thực thi

```typescript
const { status } = await Location.requestForegroundPermissionsAsync();
```

1. Gọi API Expo Location để yêu cầu quyền.
2. API trả về Promise; hàm `requestPermissions()` tạm dừng tại `await`.
3. JavaScript runtime vẫn có thể xử lý các sự kiện khác.
4. Khi Promise fulfilled, hàm tiếp tục và kiểm tra `status`.
5. Nếu Promise rejected, điều khiển chuyển vào `catch`.

**Quan trọng:** `await` không chặn toàn bộ JavaScript runtime, nhưng các câu lệnh phía sau `await` trong cùng hàm phải chờ kết quả.

## 4. Object destructuring

```typescript
const { status } = permissionResponse;
// Tương đương:
const status = permissionResponse.status;
```

Ví dụ object kết quả:

```typescript
const permissionResponse = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
};
```

**Liên hệ Erlang:**

```erlang
#{status := Status} = PermissionResponse.
```

Khác biệt: map pattern matching trong Erlang thất bại nếu thiếu key; destructuring thuộc tính thiếu trong JavaScript thông thường cho `undefined`.

## 5. Phân biệt `denied` và exception

### Người dùng từ chối

```typescript
if (status !== 'granted') {
  this.setStatus('permission_denied');
  return false;
}
```

Đây là kết quả API hợp lệ, **không nhất thiết là exception**.

### API gặp lỗi

```typescript
catch {
  this.setStatus('error');
  return false;
}
```

Promise có thể bị rejected hoặc một câu lệnh trong `try` ném exception. Code hiện tại không ghi lại chi tiết lỗi; đây là điểm có thể cải thiện để debug.

**Liên hệ Erlang (minh họa):**

```erlang
case request_permission() of
    {ok, granted} -> true;
    {ok, denied} -> false;
    {error, _Reason} -> false
end.
```

## 6. State transition trong file thực tế

`requestPermissions()` bắt đầu bằng:

```typescript
this.setStatus('requesting_permission');
```

- Nếu bị từ chối: status chuyển sang `permission_denied`, trả `false`.
- Nếu API ném lỗi: status chuyển sang `error`, trả `false`.
- Nếu được cấp quyền: trả `true`, **không tự đổi status sang `searching`**.

Caller `startLiveTracking()` (dòng 76–84) tiếp tục:

```typescript
this.stopTracking();
const hasPermission = await this.requestPermissions();
if (!hasPermission) {
  return;
}
this.setStatus('searching');
```

Như vậy, `requestPermissions()` phụ trách xin quyền; `startLiveTracking()` phụ trách tiếp tục khởi động GPS. `requestPermissions()` không phải pure function vì có side effect cập nhật status.

## 7. Code review: race condition tiềm ẩn

Kịch bản:

1. Người dùng nhấn **Start**.
2. `requestPermissions()` đang chờ iOS.
3. Người dùng nhấn **Stop**.
4. iOS trả `granted`.
5. `startLiveTracking()` tiếp tục và có thể bắt đầu GPS sau khi đã Stop.

Lý do: `stopTracking()` không tự hủy Promise đang chờ. Một cách xử lý trong bài sau là dùng generation token/cancellation guard, rồi kiểm tra sau mỗi `await`. Đây là **rủi ro từ việc đọc code**, chưa phải lỗi đã tái hiện trên thiết bị.

## 8. Câu hỏi ôn tập

**Câu 1.** `Promise<boolean>` nghĩa là gì?

A. Hàm trả boolean ngay lập tức  
B. Hàm trả Promise, khi fulfilled sẽ có giá trị boolean  
C. Hàm tạo thread

**Câu 2.** Khi gặp `await`, điều gì xảy ra?

A. Toàn bộ app bị chặn  
B. Async function tạm dừng, runtime vẫn có thể xử lý sự kiện khác  
C. Tạo Erlang process

**Câu 3.** Người dùng từ chối GPS permission có nhất thiết gây exception không?

A. Có  
B. Không; API có thể trả `denied` bình thường  
C. App tự thoát

**Câu 4.** Nếu `requestPermissions()` trả `true`, method này tự chuyển status sang gì?

A. `locked`  
B. `searching`  
C. Không đặt trạng thái mới sau khi được cấp quyền

### Đáp án

1. **B** — Promise fulfilled với giá trị boolean.
2. **B** — Chỉ tạm dừng async function hiện tại.
3. **B** — `denied` là một kết quả hợp lệ, không nhất thiết là rejection.
4. **C** — Caller `startLiveTracking()` mới đặt `searching`.

## 9. Ghi nhớ

- **Promise:** đại diện cho kết quả của thao tác bất đồng bộ.
- **`async/await`:** viết logic bất đồng bộ theo trình tự dễ đọc, không chặn toàn bộ runtime.
- **`try/catch`:** xử lý rejection/exception; phân biệt với kết quả nghiệp vụ như `denied`.
- **Race condition:** state có thể thay đổi trong thời gian chờ `await`; phải xác nhận yêu cầu còn hợp lệ khi tiếp tục.

**Bài tiếp theo:** Bài 4 — GPS Tracking và Callback (dòng 76–111).
