<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fixture_id')->constrained('fixtures')->cascadeOnDelete();
            $table->unsignedSmallInteger('home_goals');
            $table->unsignedSmallInteger('away_goals');
            $table->timestamps();

            $table->unique('fixture_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_results');
    }
};
