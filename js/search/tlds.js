/* Which top-level domains make "word.tld" an address rather than a query.

   Safari decides this against the real root zone, which is why "react.dev"
   navigates but "node.js" searches. Shipping all ~1,500 IANA entries would cost
   more than the rest of the search code together, so this carries every country
   code plus the generic TLDs people actually type. A missing one only means that
   address needs an explicit https:// — it never sends a query somewhere wrong. */

const COUNTRY = `
ac ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bm
bn bo br bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz
de dj dk dm do dz ec ee eg er es et eu fi fj fk fm fo fr ga gd ge gf gg gh gi gl
gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je
jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc
md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl
no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa
sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj tk
tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za
zm zw`;

const GENERIC = `
com net org edu gov mil int info biz name pro aero coop museum mobi asia tel
travel jobs cat post app dev page new day how foo zip mov phd esq bot xyz online
site tech store shop blog cloud design art club live news fun space website link
click top email systems agency studio digital network media group company today
world life global solutions services software ventures zone works ninja wiki guru
photo photos social chat game games run cool host ltd llc inc consulting academy
center city land money finance capital fund law legal health care clinic fit
fitness gold green house kitchen love market marketing mba one plus press pub
red rent review reviews rocks sale school science shoes show ski style support
team tips tools tours town toys trade training tube vip vision vote watch wedding
wine work yoga gle google youtube amazon apple microsoft aws nyc london tokyo
paris berlin moe ooo lol wtf build codes coffee computer dog film lgbt land
energy engineering events expert farm fashion fish garden gift gifts help
hosting immo jewelry lighting luxury management menu network partners pictures
pizza place plumbing productions properties recipes restaurant security shopping
singles solar systems technology tickets tienda video vacations voyage xyz`;

/* Never on the public internet, so a hit means a machine on your own network —
   these go out over http, the way a dev server expects. */
const LOCAL = new Set(["local", "localhost", "test", "internal", "lan", "home", "arpa", "example", "invalid"]);

const KNOWN = new Set(`${COUNTRY} ${GENERIC}`.trim().split(/\s+/));

/** @param {string} tld lower-case, no dot */
export const isKnownTld = (tld) => KNOWN.has(tld);

/** @param {string} tld lower-case, no dot */
export const isLocalTld = (tld) => LOCAL.has(tld);
