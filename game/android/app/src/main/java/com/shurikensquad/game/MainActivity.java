package com.shurikensquad.game;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayGamesPlugin.class);   // local plugin: stage leaderboard (Google Play Games)
        super.onCreate(savedInstanceState);
        // an idle game keeps playing while you watch: the screen stays on while the app is in front, and the game's own
        // power-save screen (features/powersave.js) dims it instead of the phone's screen timeout
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
