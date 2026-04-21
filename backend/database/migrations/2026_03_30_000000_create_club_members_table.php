<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained()->cascadeOnDelete();
            $table->string('member_type', 16);
            $table->string('name');
            $table->string('photo_path')->default('');
            $table->unsignedSmallInteger('jersey_number')->nullable();
            $table->string('position', 64)->nullable();
            $table->text('previous_achievements')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_members');
    }
};
