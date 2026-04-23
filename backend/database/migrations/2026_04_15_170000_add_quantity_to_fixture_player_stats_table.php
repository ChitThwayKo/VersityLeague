<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fixture_player_stats', function (Blueprint $table): void {
            $table->unsignedInteger('quantity')->default(1)->after('stat_type');
        });

        DB::table('fixture_player_stats')
            ->whereNull('quantity')
            ->update(['quantity' => 1]);
    }

    public function down(): void
    {
        Schema::table('fixture_player_stats', function (Blueprint $table): void {
            $table->dropColumn('quantity');
        });
    }
};
