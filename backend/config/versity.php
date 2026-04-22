<?php

return [
    'default_admin' => [
        'name' => env('DEFAULT_ADMIN_NAME', 'Default Administrator'),
        'email' => env('DEFAULT_ADMIN_EMAIL', 'default-admin@versity-league.local'),
        'student_staff_id' => env('DEFAULT_ADMIN_STUDENT_STAFF_ID', 'VERSITY-DEFAULT-ADMIN'),
        'password' => env('DEFAULT_ADMIN_PASSWORD', 'password'),
    ],
];
