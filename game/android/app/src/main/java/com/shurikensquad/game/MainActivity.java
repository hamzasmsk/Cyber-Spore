package com.shurikensquad.game;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayGamesPlugin.class);   // local plugin: stage leaderboard (Google Play Games)
        super.onCreate(savedInstanceState);
    }
}
