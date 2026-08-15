let _CONFIG = {
  wispurl: (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/",
  bareurl: (location.protocol === "https:" ? "https" : "http") + "://" + location.host + "/bare/"
};