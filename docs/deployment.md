# 部署指南 v1.0

## 本地开发

后端：
```bash
cd backend
pip install -r requirements.txt
# 需要 MySQL（或改 DATABASE_URL 为 sqlite 调试）
uvicorn app.main:app --reload
```

规则引擎测试（无外部依赖）：
```bash
python3 backend/tests/test_mahjong.py   # 47 项
```

前端：
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173，代理到 :8000
```

## Docker 一键部署（Ubuntu）

```bash
# 1. 安装 docker / docker-compose
# 2. 配置环境变量
cp deploy/.env.example deploy/.env   # 按需创建，填 JWT_SECRET / MYSQL_PASSWORD
# 3. 启动
cd deploy && docker-compose up -d --build
```

服务：Nginx :80 → 前端 :3000 / 后端 :8000；MySQL :3306；Redis :6379。

## 生产注意事项

- JWT_SECRET 必须换成强随机值；CORS 收紧为前端域名。
- MySQL 数据卷定期备份；Redis 开启持久化。
- HTTPS：Nginx 挂证书（certbot），WS 走 wss。
- 后端多实例：对局状态从内存移到 Redis（TODO Phase 2）。
