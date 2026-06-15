// Root stack — screens that cover everything including the tab bar
export type RootStackParamList = {
  Main: undefined;
  NowPlaying: undefined;
  Artist: { artistId: string; artistName: string };
  Album: { albumId: string };
  Playlist: { playlistId: string; playlistName?: string };
  LikedSongs: undefined;
  Queue: undefined;
  Profile: undefined;
};

// Bottom tabs — only 3, matching Spotify
export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
};
