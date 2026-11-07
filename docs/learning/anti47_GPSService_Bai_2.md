# GPSService.ts — Bài 2: Getter, Callback, Closure và Pub/Sub

**Dự án:** anti47  
**Nguồn:** `GPSService.ts`, dòng 35–59; tham chiếu thêm dòng 21–28, 147–160.  
**Mục tiêu:** Đọc được chữ ký hàm TypeScript, hiểu cách đăng ký/hủy đăng ký callback và so sánh với Erlang.

## 1. Getter: đọc trạng thái của service

```typescript
public getStatus(): GPSStatus {
  return this.status;
}

public getCurrentFix(): GPSFix | null {
  return this.currentFix;
}
```

- `public`: method có thể được gọi từ bên ngoài class.
- `(): GPSStatus`: không có tham số, trả về giá trị kiểu `GPSStatus`.
- `GPSFix | null`: trả về một GPS fix hoặc `null` nếu chưa có dữ liệu.
- `this`: instance hiện tại của `GPSService`.
- `status` và `currentFix` được khai báo `private`; getter cung cấp đường đọc có kiểm soát.

**So sánh Erlang:** Một `gen_server` có thể cung cấp `get_status/0` bằng `gen_server:call/2`. Nhưng getter TypeScript chỉ là lời gọi method trực tiếp; nó không gửi message và không tạo process isolation.

```erlang
get_status() ->
    gen_server:call(?MODULE, get_status).

handle_call(get_status, _From, State) ->
    {reply, State#state.status, State}.
```

## 2. Đọc chữ ký subscribe()

Code gốc (dòng 43–51):

```typescript
public subscribe(callback: (fix: GPSFix) => void): () => void {
  this.fixSubscribers.add(callback);
  if (this.currentFix) {
    callback(this.currentFix);
  }
  return () => {
    this.fixSubscribers.delete(callback);
  };
}
```

Đọc từ trong ra ngoài:

- `(fix: GPSFix) => void`: kiểu của một **function** nhận `GPSFix`, không trả về giá trị hữu ích.
- `callback: ...`: tham số `callback` phải là function có chữ ký đó.
- `: () => void`: **subscribe trả về một function khác**, không nhận tham số và không trả về giá trị hữu ích.

Ví dụ sử dụng:

```typescript
const unsubscribe = gpsService.subscribe((fix) => {
  console.log('New GPS fix:', fix);
});

// Khi không còn muốn nhận cập nhật:
unsubscribe();
```

`subscribe()` làm ba việc:

1. Thêm callback vào `fixSubscribers`.
2. Nếu `currentFix` đã tồn tại, gọi callback ngay với giá trị hiện tại.
3. Trả về function để xóa callback khỏi tập subscribers.

Nếu `currentFix === null`, callback **không được gọi ngay**, nhưng vẫn được đăng ký để nhận cập nhật về sau.

## 3. Set và function reference

Khai báo trong class (dòng 27):

```typescript
private fixSubscribers = new Set<(fix: GPSFix) => void>();
```

`Set` là tập hợp các giá trị không trùng nhau theo định danh/tham chiếu. Ở đây các giá trị là function. Thêm cùng một function reference hai lần chỉ tạo một phần tử; hai arrow function được tạo riêng vẫn là hai reference khác nhau.

```typescript
const listeners = new Set<(speed: number) => void>();
const logSpeed = (speed: number) => console.log(speed);
listeners.add(logSpeed);
listeners.add(logSpeed); // Không thêm bản sao thứ hai
```

## 4. Closure: vì sao unsubscribe vẫn nhớ callback?

```typescript
return () => {
  this.fixSubscribers.delete(callback);
};
```

Function trả về là **closure**: nó giữ quyền truy cập tới `callback` và `this` thuộc môi trường nơi nó được tạo ra. Vì vậy, dù `subscribe()` đã return, gọi `unsubscribe()` sau này vẫn xóa đúng callback.

Ví dụ dễ hiểu:

```typescript
function createCounter() {
  let count = 0;
  return () => ++count;
}
const counter = createCounter();
counter(); // 1
counter(); // 2
```

**So sánh Erlang:** Erlang `fun` cũng có thể capture biến bên ngoài, nhưng biến Erlang là immutable sau khi bind; JavaScript closure có thể cập nhật một biến `let`.

```erlang
Multiplier = 2,
Double = fun(X) -> X * Multiplier end,
Double(5). % 10
```

## 5. subscribeStatus(): gần giống, nhưng phát trạng thái ngay

Code gốc (dòng 53–59):

```typescript
public subscribeStatus(callback: (status: GPSStatus) => void): () => void {
  this.statusSubscribers.add(callback);
  callback(this.status);
  return () => {
    this.statusSubscribers.delete(callback);
  };
}
```

Khác biệt so với `subscribe()`:

- `subscribeStatus()` **luôn** gọi callback ngay sau đăng ký vì `status` có giá trị khởi tạo `'idle'`.
- `subscribe()` chỉ gọi ngay khi `currentFix` khác `null`.
- Cả hai đều trả về unsubscribe function.

## 6. Publish: ai gọi các subscriber?

Code gốc (dòng 156–160):

```typescript
private notifyFix(fix: GPSFix): void {
  for (const subscriber of this.fixSubscribers) {
    subscriber(fix);
  }
}
```

Luồng dữ liệu của GPS fix:

```text
Expo Location / GPS Simulator
             |
             v
         GPSService
             |
             v
      notifyFix(GPSFix)
             |
       +-----+------+
       |            |
       v            v
   UI callback   callback khác
```

Đây là Pub/Sub trong cùng JavaScript runtime. Các callback được gọi **đồng bộ**, theo thứ tự duyệt của `Set`.

**So sánh Erlang:**

```erlang
lists:foreach(
    fun(Pid) -> Pid ! {gps_fix, Fix} end,
    Subscribers
).
```

| Chủ đề | TypeScript trong file này | Erlang message passing |
|---|---|---|
| Phát sự kiện | Gọi callback trực tiếp | Gửi message tới mailbox |
| Tính đồng bộ | Callback chạy đồng bộ | Gửi message bất đồng bộ |
| Cách ly | Không có process isolation | Process riêng |
| Subscriber lỗi | Exception có thể làm gián đoạn vòng lặp | Process nhận có thể lỗi độc lập |

## 7. Điểm cần chú ý khi review

1. **Exception isolation:** `notifyFix()` không bắt lỗi riêng cho từng callback. Một callback ném exception có thể ngăn callback sau nhận dữ liệu.
2. **Immediate callback:** `subscribe()` và `subscribeStatus()` có thể gọi callback **ngay trong lúc đăng ký**. Caller cần sẵn sàng xử lý.
3. **Cleanup:** Caller phải giữ và gọi function unsubscribe khi không còn sử dụng, ví dụ trong cleanup của React `useEffect`.
4. **Không nhầm với GPS subscription:** `fixSubscribers` là danh sách callback của ứng dụng; `locationSubscription` (dòng 25) là subscription tới API vị trí của Expo. Đây là hai vòng đời khác nhau.

Những điểm trên là nhận xét về code hiện tại; không đồng nghĩa mọi điểm đều là bug cần sửa ngay.

## 8. Câu hỏi ôn tập

**Câu 1.** Vì sao `subscribe()` trả về `() => void`?  
A. Để lấy GPS fix ngay  
B. Để caller hủy đăng ký callback  
C. Để tự bật GPS

**Câu 2.** Nếu `currentFix` là `null`, gọi `subscribe()` sẽ thế nào?  
A. Callback chưa được gọi ngay nhưng đã được đăng ký  
B. Callback nhận `null`  
C. Ném lỗi

**Câu 3.** Khác biệt chính giữa `notifyFix()` và `Pid ! Message`?  
A. Cả hai đều tạo process  
B. Callback chạy đồng bộ; gửi message Erlang là bất đồng bộ  
C. Callback luôn nhanh hơn

**Câu 4.** Nếu callback đầu tiên ném exception trong `notifyFix()`?  
A. Mọi callback còn lại chắc chắn được gọi  
B. Vòng lặp có thể bị gián đoạn  
C. GPSService tự restart

### Đáp án

1. **B** — Trả về closure xóa đúng callback.
2. **A** — Không phát fix ban đầu khi `currentFix` là `null`.
3. **B** — Gọi hàm trực tiếp khác với gửi message vào mailbox.
4. **B** — Không có `try/catch` bảo vệ từng subscriber.

## 9. Ghi nhớ sau bài học

- **Getter** đọc state được class đóng gói.
- **Callback** là function truyền làm tham số.
- **Closure** giúp function unsubscribe nhớ callback đã đăng ký.
- **Set** lưu các subscriber theo function reference.
- **Pub/Sub** tách bên phát GPS update khỏi bên nhận, nhưng phiên bản này **không có process isolation** như Erlang.

**Bài tiếp theo:** Promise, `async/await` và GPS permission (dòng 61–74).
