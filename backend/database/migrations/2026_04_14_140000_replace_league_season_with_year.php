<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leagues')) {
            return;
        }

        if (! Schema::hasColumn('leagues', 'year')) {
            Schema::table('leagues', function (Blueprint $table): void {
                $table->string('year', 100)->nullable()->after('name');
            });
        }

        if (Schema::hasColumn('leagues', 'season')) {
            DB::statement("UPDATE leagues SET year = season WHERE year IS NULL OR year = ''");
            Schema::table('leagues', function (Blueprint $table): void {
                $table->dropColumn('season');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('leagues')) {
            return;
        }

        if (! Schema::hasColumn('leagues', 'season')) {
            Schema::table('leagues', function (Blueprint $table): void {
                $table->string('season', 100)->nullable()->after('name');
            });
        }

        if (Schema::hasColumn('leagues', 'year')) {
            DB::statement("UPDATE leagues SET season = year WHERE season IS NULL OR season = ''");
            Schema::table('leagues', function (Blueprint $table): void {
                $table->dropColumn('year');
            });
        }
    }
};
