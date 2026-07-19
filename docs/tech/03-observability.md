# 03 — 觀測:OpenTelemetry

> 狀態:**待審查**。prod 前提 = GCP(apis = Cloud Run service、grant-worker = worker pool、expiry-job = Cloud Run Job)。

## 決策

**1. 統一 OTel / OTLP(push)**

- Prometheus pull 否決:Cloud Run 實例無穩定刮取目標;worker 無 HTTP 入口。

**2. v1 接線、靜默停用**

- 未設 `OTEL_EXPORTER_OTLP_ENDPOINT` 即本地零依賴。
- span 結構與欄位慣例在寫程式碼當下定(retrofit 是重工);exporter 隨時可掛。

**3. 批次 trace 用 span links**

- 同步 API:一請求一 trace。
- 發點任務:worker 每次認領開新 trace、link 回 `:issue`;chunk 為其下 span。
- 重投各自成 trace;不產生千萬級單一巨型 trace。

**4. 業務指標自 core 發**

- tracing 事件慣例:`monotonic_counter.*` / `histogram.*`。
- shell 掛 `MetricsLayer` 橋接;core 只依賴 tracing。

**5. 基數鐵律**

- label 只放有限集合:route、status、strategy、transaction_type。
- `customer_id` / `issuance_id` 永不進 label;高基數歸 log/trace。

**6. logs 走 stdout**

- dev 人讀格式;prod JSON + trace 欄位(Cloud Logging 自動關聯 Cloud Trace)。
- 不走 OTLP logs。

**7. Sampling**

- dev 100%;壓測 / prod 以環境變數調比例。
- Cloud Trace 按 span 計費——sampling 也是帳單題。

## 指標清單

- API RED:每路由請求率、錯誤率、延遲直方圖。
- 業務:`grants_total`、`granted_points_total`、`redemptions_total{result}`、`expired_points_total`。
- 管線:chunk 延遲直方圖、入帳行/秒、redelivery 計數、NATS `num_pending`。
- 壓測:兌換延遲直方圖帶 `strategy` label(兩種鎖策略 P99 對比)。
- 資源:sqlx pool 使用率。

## 遙測歸屬(對齊 PbC)

- apps:HTTP 層(TraceLayer、RED)+ SDK 初始化與 exporter。
- component adapters:SQL / NATS 的 span 與指標、traceparent 注入/擷取。
- component core:業務事件(不知道 OTel 存在)。

## 部署拓撲

- **dev**:`grafana/otel-lgtm` 單容器直推;root compose 掛 profile,不擋 `make up`。
- **prod(GCP)**:
  - internal-api / storefront-api = Cloud Run services + otel-collector sidecar(app 推 `localhost:4317`)。
  - grant-worker = Cloud Run worker pool(CPU 常駐,consumer 與背景 flush 天然成立)。
  - expiry-job = Cloud Run Job(Cloud Scheduler 排程;結束前 flush exporter)。
  - 已知坑:request-based billing 下請求外 CPU 被掐,`BatchSpanProcessor` flush 會餓死。
- **不決**:NATS 在 GCP 的落點(Synadia NGS vs GKE/GCE),留給部署文件。

## 版本錨點(2026-07-19 鎖定,已進依賴表)

```toml
opentelemetry         = "0.32.0"
opentelemetry_sdk     = { version = "0.32.1", features = ["rt-tokio"] }
opentelemetry-otlp    = { version = "0.32.0", default-features = false,
                          features = ["grpc-tonic", "trace", "metrics", "internal-logs"] }
tracing-opentelemetry = { version = "0.33.0", features = ["metrics"] } # 0.33 ↔ opentelemetry 0.32
tracing-subscriber    = { version = "0.3.23", features = ["env-filter", "json"] }
```

- otlp 關預設:預設 http-proto + blocking reqwest 不合 tokio;logs 訊號不開。
- 只列在 apps。
- 升版:三件套同步、橋接版 +1、`cargo tree -d` 驗無分裂。
