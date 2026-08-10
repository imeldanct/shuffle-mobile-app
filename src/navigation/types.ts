// Root stack — screens that cover everything including the tab bar
export type RootStackParamList = {
  Main: undefined;
  NowPlaying: undefined;
  Artist: { artistId: string; artistName: string };
  Album: { albumId: string };
  Playlist: { playlistId: string; playlistName?: string };
  Show: { showId: string; showName?: string };
  Audiobook: { audiobookId: string; audiobookName?: string };
  LikedSongs: undefined;
  Queue: undefined;
  Profile: undefined;
};

// Bottom tabs — matching Spotify's 4: Home, Search, Your Library, Create
export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
  Create: undefined;
};
