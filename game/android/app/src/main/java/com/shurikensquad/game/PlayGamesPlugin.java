package com.shurikensquad.game;

import android.content.Intent;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * Google Play Games (v2) for the stage leaderboard: sign-in, score submit and the leaderboard screen.
 * Stays switched off until res/values/games-ids.xml holds the game's Play Games project id and leaderboard id
 * (Play Console > Play Games Services). JS side: features/ranking.js.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {
    private boolean ready = false;

    private String res(String name) {
        int id = getContext().getResources().getIdentifier(name, "string", getContext().getPackageName());
        return id == 0 ? "" : getContext().getString(id).trim();
    }

    private boolean configured() {
        String app = res("game_services_project_id");
        return !TextUtils.isEmpty(app) && TextUtils.isDigitsOnly(app) && !TextUtils.isEmpty(res("leaderboard_best_stage"));
    }

    @Override
    public void load() {
        if (!configured()) return;
        try {
            PlayGamesSdk.initialize(getContext());
            ready = true;
        } catch (Exception e) {
            ready = false;
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("configured", configured());
        r.put("ready", ready);
        if (!ready) { r.put("signedIn", false); call.resolve(r); return; }
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated().addOnCompleteListener(t -> {
            r.put("signedIn", t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!ready) { call.reject("not_configured"); return; }
        PlayGames.getGamesSignInClient(getActivity()).signIn().addOnCompleteListener(t -> {
            JSObject r = new JSObject();
            r.put("signedIn", t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void submitBestStage(PluginCall call) {
        if (!ready) { call.reject("not_configured"); return; }
        Long score = call.getLong("score");
        if (score == null || score < 1) { call.reject("bad_score"); return; }
        PlayGames.getLeaderboardsClient(getActivity()).submitScore(res("leaderboard_best_stage"), score);
        call.resolve();
    }

    @PluginMethod
    public void showLeaderboard(PluginCall call) {
        if (!ready) { call.reject("not_configured"); return; }
        PlayGames.getLeaderboardsClient(getActivity()).getLeaderboardIntent(res("leaderboard_best_stage"))
            .addOnSuccessListener(intent -> { getActivity().startActivityForResult(intent, 9004); call.resolve(); })
            .addOnFailureListener(e -> call.reject("not_signed_in"));
    }
}
