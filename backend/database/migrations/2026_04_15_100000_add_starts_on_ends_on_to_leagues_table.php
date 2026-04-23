<?php

use App\Models\League;
use App\Services\StandingsRecalculationService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leagues', function (Blueprint $table): void {
            $table->date('starts_on')->nullable()->after('year');
            $table->date('ends_on')->nullable()->after('starts_on');
        });

        foreach (League::query()->pluck('id') as $leagueId) {
            app(StandingsRecalculationService::class)->recalculateForLeague((int) $leagueId);
        }
    }

    public function down(): void
    {
        Schema::table('leagues', function (Blueprint $table): void {
            $table->dropColumn(['starts_on', 'ends_on']);
        });
    }
};
