<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PublicStatsController extends Controller
{
    /**
     * Homepage aggregates (all seasons): distinct non-blank student/staff IDs on player records.
     */
    public function home(): JsonResponse
    {
        $total = (int) DB::table('players')
            ->whereRaw('TRIM(COALESCE(student_staff_id, \'\')) <> ?', [''])
            ->selectRaw('COUNT(DISTINCT TRIM(student_staff_id)) AS c')
            ->value('c');

        return response()->json([
            'total_players' => $total,
        ]);
    }
}
