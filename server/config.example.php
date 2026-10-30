<?php
// Copy outside public_html to ~/avecjo-config.php. Never commit the real file.
return [
    'cmsDataDir' => __DIR__ . '/avecjo-data', // Private JSON, accounts, sessions and audit trail.
    'appKey' => '', // Generate: php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    // Optional: fill these only when enabling the contact form/customer database.
    'dsn' => '', // mysql:host=localhost;port=3306;dbname=avecjo;charset=utf8mb4
    'username' => '',
    'password' => '',
    'allowedOrigins' => [
        'https://avec-jo.web.app', 'https://avec-jo.firebaseapp.com',
        'https://www.guidehanoi.com', 'https://guidehanoi.com',
    ],
];
