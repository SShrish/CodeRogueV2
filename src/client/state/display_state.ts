import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { useGetStateQuery } from '../client/server_api';

const playerStep = 8;

interface DisplayState {
    style: number,
    level: number,
    coords: [number, number] | null,
    firstPlayer: number,
    highlightedPlayer: number | null,
}

const initialState: DisplayState = {
    style: 0,
    level: 1,
    coords: null,
    firstPlayer: 0,
    highlightedPlayer: null,
};

export const displaySlice = createSlice({
    name: 'display',
    initialState,
    reducers: {
        setPrevStyle: (state) => { state.style = 0; },
        setNextStyle: (state) => { state.style = 1; },
        showFirstLevel: (state) => { state.level = 1; },
        showPrevLevel: (state) => { state.level = Math.max(state.level - 1, 1); },
        showNextLevel: (state, { payload }: PayloadAction<number>) => {
            let numLevels: number = payload;
            state.level = Math.min(state.level + 1, numLevels);
        },
        showLastLevel: (state, { payload }: PayloadAction<number>) => {
            let numLevels: number = payload;
            state.level = numLevels;
        },
        setCoords: (state, { payload }: PayloadAction<[number, number] | null>) => {
            let coords: [number, number] | null = payload;
            state.coords = coords;
        },
        showFirstPlayer: (state) => {
            state.firstPlayer = 0;
        },
        showPrevPlayer: (state) => {
            state.firstPlayer = Math.max(state.firstPlayer - playerStep, 0);
        },
        showNextPlayer: (state, { payload }: PayloadAction<number>) => {
            let numPlayers: number = payload;
            state.firstPlayer = Math.min(state.firstPlayer + playerStep, numPlayers - playerStep);
        },
        showLastPlayer: (state, { payload }: PayloadAction<number>) => {
            let numPlayers: number = payload;
            state.firstPlayer = numPlayers - playerStep;
        },
        highlightPlayer: (state, { payload }: PayloadAction<number | null>) => {
            let playerToHighlight: number | null = payload;
            if (state.highlightedPlayer == playerToHighlight) playerToHighlight = null;
            state.highlightedPlayer = playerToHighlight;
        },
    },
});
