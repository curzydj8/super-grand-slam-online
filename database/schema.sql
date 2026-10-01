-- Super Grand Slam Online · MySQL Schema v1.0
-- 字符集 utf8mb4。以本文件为准，SQLAlchemy models 仅作 ORM 映射。
CREATE DATABASE IF NOT EXISTS sgs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sgs;

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  gold INT DEFAULT 10000,
  diamond INT DEFAULT 0,
  rank_score INT DEFAULT 0,
  rank_name VARCHAR(16) DEFAULT '新手',
  win_count INT DEFAULT 0,
  match_count INT DEFAULT 0,
  max_win_streak INT DEFAULT 0,
  status TINYINT DEFAULT 1 COMMENT '1正常 0封禁',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rank_score (rank_score),
  INDEX idx_gold (gold)
) ENGINE=InnoDB;

CREATE TABLE match_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  mode VARCHAR(16) DEFAULT 'ai' COMMENT 'ai/rank/casual',
  players JSON NOT NULL COMMENT '[{uid,nickname,score,rank}]',
  winner BIGINT,
  score JSON COMMENT '结算明细 {uid: 点数变动}',
  rounds INT DEFAULT 8,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  INDEX idx_room (room_id),
  INDEX idx_winner (winner)
) ENGINE=InnoDB;

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  kind VARCHAR(16) DEFAULT 'daily' COMMENT 'daily/achievement',
  target INT DEFAULT 1,
  reward_gold INT DEFAULT 0,
  reward_diamond INT DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE user_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  task_id INT NOT NULL,
  progress INT DEFAULT 0,
  claimed BOOLEAN DEFAULT FALSE,
  `date` VARCHAR(10) DEFAULT '',
  UNIQUE KEY uk_user_task_date (user_id, task_id, `date`),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
) ENGINE=InnoDB;

CREATE TABLE shop_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL COMMENT 'avatar/frame/table/cloth/back/effect/title',
  price_gold INT DEFAULT 0,
  price_diamond INT DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  item_id INT NOT NULL,
  equipped BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES shop_items(id)
) ENGINE=InnoDB;

CREATE TABLE mails (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '0=全服邮件',
  title VARCHAR(128) NOT NULL,
  body TEXT,
  attachments JSON,
  `read` BOOLEAN DEFAULT FALSE,
  claimed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  body TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 种子任务（MVP 每日任务）
INSERT INTO tasks (code, name, kind, target, reward_gold) VALUES
('daily_matches', '完成3局对局', 'daily', 3, 1000),
('daily_wins', '胡牌5次', 'daily', 5, 1000),
('ach_first_win', '首次胡牌', 'achievement', 1, 500),
('ach_100_matches', '完成100局', 'achievement', 100, 5000),
('ach_1000_matches', '完成1000局', 'achievement', 1000, 30000);
