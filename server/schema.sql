-- Optional: customer contact data only. CMS content and accounts use private files.
CREATE TABLE IF NOT EXISTS leads (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 request_id CHAR(36) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 email VARCHAR(200) NOT NULL,
 phone VARCHAR(60) NOT NULL DEFAULT '',
 message TEXT NOT NULL,
 source VARCHAR(500) NOT NULL,
 status ENUM('new','contacted','qualified','closed','spam') NOT NULL DEFAULT 'new',
 notes TEXT NOT NULL,
 consent_at DATETIME NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX (status,id), INDEX (created_at), INDEX (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
