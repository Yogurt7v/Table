/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/{path...}", $apis.static($os.dirFS("./pb_public"), true));
