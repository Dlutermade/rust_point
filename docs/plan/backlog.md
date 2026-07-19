# Backlog(跨 context / 未排程)

> 尚未綁定迭代的需求池;成熟時升級為 `plan/NN` 或 `tech/NN` 文件。

## 事件中心(NATS 作為跨 context 事件骨幹)

- 立場:發布方擁有自己的 stream;訂閱方自建 durable consumer 自主消費(group / 聚合 / 速率歸訂閱方 owner)。
- 待定:
  - subject 命名規約(跨 context:`{context}.{聚合}.{事件}`)
  - 事件合約文件化(schema 不走共享 crate)
  - NATS accounts 權限(發布/訂閱分權)
  - retention SLA(可回放承諾)
- 觸發時機:第二個訂閱 context 進場時定案。
