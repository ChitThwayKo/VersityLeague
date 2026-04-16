<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('student_staff_id', 100)->unique()->after('email');
            $table->enum('role', ['client', 'admin', 'default_admin'])->default('client')->after('student_staff_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['student_staff_id', 'role']);
        });
    }
};
