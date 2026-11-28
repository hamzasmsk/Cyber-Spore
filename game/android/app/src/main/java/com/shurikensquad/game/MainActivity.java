package com.shurikensquad.game;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayGamesPlugin.class);   // local plugin: stage leaderboard (Google Play Games)
        // Android 15+ draws apps edge to edge; opt in explicitly (the SystemBars plugin keeps the UI clear of the bars)
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        // phones stay in portrait; tablets, foldables and Chromebooks may rotate and resize freely (the game keeps a
        // centred portrait column on wide screens, game.js colBox), as Google Play asks for large screens
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        // an idle game keeps playing while you watch: the screen stays on while the app is in front, and the game's own
        // power-save screen (features/powersave.js) dims it instead of the phone's screen timeout
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
