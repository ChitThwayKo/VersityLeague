<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixture_player_stats', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fixture_id')->constrained('fixtures')->cascadeOnDelete();
            $table->foreignId('player_id')->constrained('players')->cascadeOnDelete();
            $table->enum('stat_type', ['participant', 'goal', 'assist']);
            $table->timestamps();

            $table->unique(['fixture_id', 'player_id', 'stat_type'], 'fixture_player_stats_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixture_player_stats');
    }
};
