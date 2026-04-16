<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('club_id')->nullable()->constrained('clubs')->nullOnDelete();
            $table->enum('type', ['champion', 'runner_up', 'top_scorer', 'participation']);
            $table->string('title');
            $table->string('student_staff_id', 100);
            $table->year('participate_year_start');
            $table->year('participate_year_end');
            $table->string('positions_played');
            $table->unsignedInteger('scored')->default(0);
            $table->unsignedInteger('assisted')->default(0);
            $table->string('file_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
