const paths:Record<string,string>={
 stop:'M6 6h12v12H6Z',play:'M8 4v16l13-8Z',pause:'M8 4v16M16 4v16',save:'M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8',load:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 gear:'m9 3 1-2h4l1 2 3 1 2 3-1 3v4l1 3-2 3-3 1-1 2h-4l-1-2-3-1-2-3 1-3v-4L4 7l2-3Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',keyboard:'M2 5h20v14H2ZM6 9h1m3 0h1m3 0h1m3 0h1M6 13h1m3 0h1m3 0h1m3 0h1M7 16h10',
 exit:'M13 3H4v18h9M10 12h12m-5-5 5 5-5 5',flag:'M4 22V3m0 1c6-5 9 5 16 0v10c-7 5-10-5-16 0',mail:'M2 5h20v14H2Zm0 0 10 9L22 5M2 19l7-7m6 0 7 7',group:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-4c0-5 14-5 14 0v4ZM17 4a3 3 0 1 1 0 6m2 3c3 1 3 4 3 8',
 soldier:'M5 13V9a7 7 0 0 1 14 0v4M3 13h18M7 13v7l5 3 5-3v-7M9 15h6',factory:'M3 21V11l6 3V9l6 4V7h4l2 14ZM6 18h1m4 0h1m4 0h1M17 7V2',move:'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4',
 shield:'M4 3h16v10c0 5-8 9-8 9s-8-4-8-9ZM12 3v19',home:'m2 12 10-9 10 9M5 10v11h5v-7h4v7h5V10',cancel:'M6 6l12 12M18 6 6 18M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',plus:'M12 4v16M4 12h16',sound:'M3 9h4l5-5v16l-5-5H3Zm13-2c4 2 4 8 0 10m3-13c7 5 7 11 0 16',help:'M9 7a3 3 0 1 1 5 2c-3 1-2 4-2 4m0 4v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',build:'m3 21 8-8M14 4l6 6M11 7l6-6 6 6-6 6Zm0 0-4 4 6 6 4-4',target:'M12 1v5m0 12v5M1 12h5m12 0h5M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
};
export function icon(name:string):string{return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]??paths.plus}"/></svg>`;}
