<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixtures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('season_id')->constrained()->cascadeOnDelete();
            $table->string('match_number', 64)->nullable();
            $table->foreignId('home_club_id')->constrained('clubs')->restrictOnDelete();
            $table->foreignId('away_club_id')->constrained('clubs')->restrictOnDelete();
            $table->dateTime('kickoff_at');
            $table->string('venue_name');
            $table->string('venue_location')->nullable();
            $table->string('competition_name');
            $table->string('round_label')->nullable();
            $table->string('status', 32)->default('scheduled');
            $table->timestamps();

            $table->index(['season_id', 'kickoff_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixtures');
    }
};
