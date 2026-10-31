/* বাংলা ভয়েস টাইপিং — প্রচলিত শব্দের বিল্ট-ইন তালিকা (ফোনেটিক টাইপিং-এর জন্য)
 * নিয়ম দিয়ে যে শব্দগুলো ঠিকভাবে বানানো যায় না (jonno → জন্ন ✗, জন্য ✓), সেগুলো এখানে।
 *
 * লেখার নিয়ম — প্রতি লাইনে একটা শব্দ:   ইংরেজি-লেখা  বাংলা১  [বাংলা২ …]
 *   • প্রথম বাংলাটা বিকল্প-তালিকার সবার ওপরে বসে, বাকিগুলো তার পরে (এই ক্রমেই)।
 *   • ইংরেজি লেখা ছোট/বড় হাতের হিসাবে হুবহু মিলতে হবে (T ≠ t), তাই সাধারণত সব ছোট হাতে লিখুন।
 *   • একই শব্দের একাধিক রোমান বানান থাকলে আলাদা লাইনে দিন (jonno, jonyo)।
 *   • `#` দিয়ে শুরু হওয়া লাইন মন্তব্য। ফাঁকা লাইন বাদ যায়।
 * এই ফাইলে DOM-এর কিছু নেই; Node দিয়ে টেস্ট করা যায়। */
(function (root) {
  'use strict';

  const RAW = `
# ---- সর্বনাম ও প্রশ্ন
ami আমি
amar আমার
amake আমাকে
amra আমরা
amader আমাদের
tumi তুমি
tomar তোমার
tomake তোমাকে
tomra তোমরা
tomader তোমাদের
apni আপনি
apnar আপনার
apnake আপনাকে
apnara আপনারা
apnader আপনাদের
tui তুই
tor তোর
toke তোকে
se সে
tar তার
take তাকে
tara তারা
tader তাদের
ei এই
eta এটা এটি
eti এটি
oi ওই
ota ওটা
ke কে
ki কি কী
keno কেন
kothay কোথায়
kothao কোথাও
kokhon কখন
kokhono কখনো কখনও
kobe কবে
kemon কেমন
kivabe কীভাবে কিভাবে
kibhabe কীভাবে কিভাবে
koto কত
kon কোন
kono কোনো কোন
kichu কিছু
kew কেউ
keu কেউ
sei সেই
shei সেই
jei যেই
je যে
jara যারা
jar যার
jake যাকে

# ---- সংযোজক ও অব্যয়
ebong এবং
ar আর
kintu কিন্তু
tobe তবে
tobu তবু
tai তাই
jodi যদি
tahole তাহলে
tahle তাহলে
karon কারণ
jonno জন্য
jonyo জন্য
jeno যেন
ba বা
othoba অথবা
naki নাকি
shudhu শুধু
sudhu শুধু
abar আবার
aro আরও আরো
onek অনেক
ektu একটু
ekdom একদম
khub খুব
beshi বেশি
besi বেশি
kom কম
prai প্রায়
shob সব
sob সব
shobai সবাই
sobai সবাই
shobar সবার
sobar সবার
shobaike সবাইকে
sobaike সবাইকে
onno অন্য
onnano অন্যান্য
moto মতো মত
moton মতন
shathe সাথে
sathe সাথে
songe সঙ্গে
shonge সঙ্গে
theke থেকে
porjonto পর্যন্ত
modhye মধ্যে
moddhe মধ্যে
vitore ভেতরে
bhitore ভেতরে
bhetore ভেতরে
baire বাইরে
upor উপর
upore উপরে
niche নিচে
shamne সামনে
samne সামনে
pichone পিছনে
kache কাছে
dure দূরে
majhe মাঝে
ekshathe একসাথে
ekshate একসাথে
shesh শেষ
sesh শেষ
shuru শুরু
suru শুরু
prothom প্রথম
ditiyo দ্বিতীয়
tritiyo তৃতীয়

# ---- সময় ও জায়গা
ekhon এখন
tokhon তখন
jokhon যখন
aj আজ
ajke আজকে
kal কাল
porshu পরশু
ekhane এখানে
okhane ওখানে
shekhane সেখানে
sekhane সেখানে
jekhane যেখানে
ekhono এখনো এখনও
tokhono তখনো তখনও
shomoy সময়
somoy সময়
din দিন
raat রাত
rat রাত
shokal সকাল
sokal সকাল
bikel বিকেল
bikal বিকাল
dupur দুপুর
shondha সন্ধ্যা
sondha সন্ধ্যা
ghonta ঘণ্টা
minit মিনিট
shopta সপ্তাহ
mash মাস
bochor বছর
age আগে
ager আগের
pore পরে পড়ে
porer পরের
robibar রবিবার
shombar সোমবার
sombar সোমবার
mongolbar মঙ্গলবার
budhbar বুধবার
brihoshpotibar বৃহস্পতিবার
shukrobar শুক্রবার
shonibar শনিবার

# ---- সংখ্যা
ek এক
ekta একটা
ekti একটি
dui দুই
duto দুটো
tin তিন
tinte তিনটে
char চার
panch পাঁচ
choy ছয়
shat সাত
sat সাত
at আট
noy নয়
dosh দশ
osh দশ
ekush একুশ
shoto শত
hajar হাজার
lokkho লক্ষ
koti কোটি

# ---- ক্রিয়া
kore করে
kori করি
koro করো
korun করুন
korbo করবো করব
korbe করবে
korchi করছি
korcho করছো করছ
korchen করছেন
korche করছে
korechi করেছি
korecho করেছো করেছ
koreche করেছে
korte করতে
korle করলে
korlam করলাম
korlo করলো করল
hoy হয়
hobe হবে
hoye হয়ে
hoyeche হয়েছে
hoyechhe হয়েছে
hocche হচ্ছে
hochchhe হচ্ছে
holo হলো হল
hole হলে
hote হতে
jai যাই
jabo যাবো যাব
jabe যাবে
jachchi যাচ্ছি
jacchi যাচ্ছি
jacche যাচ্ছে
jao যাও
jan যান
jete যেতে
gelo গেলো গেল
gechi গেছি
geche গেছে
gechhe গেছে
ashi আসি
asbo আসবো আসব
ashbe আসবে
asbe আসবে
asho আসো
esho এসো
eshe এসে
ese এসে
aschhe আসছে
asche আসছে
ashchi আসছি
aschi আসছি
achi আছি
acho আছো আছ
achen আছেন
ache আছে
nai নাই
nei নেই
bolo বলো
bolchi বলছি
bole বলে
bolbo বলবো বলব
boli বলি
bolen বলেন
bollam বললাম
bolte বলতে
dekho দেখো
dekhi দেখি
dekhbo দেখবো দেখব
dekhe দেখে
dekhlam দেখলাম
dekhte দেখতে
shuno শোনো
suno শোনো
shuni শুনি
shunbo শুনবো শুনব
khai খাই
khabo খাবো খাব
khacchi খাচ্ছি
kheyechi খেয়েছি
kheye খেয়ে
dao দাও
dibo দিবো দিব
dilam দিলাম
diyechi দিয়েছি
diye দিয়ে
dite দিতে
nao নাও
nibo নিবো নিব
niye নিয়ে
nilam নিলাম
nite নিতে
pari পারি
parbo পারবো পারব
parbe পারবে
paro পারো
parchi পারছি
pai পাই
pabo পাবো পাব
peyechi পেয়েছি
peye পেয়ে
pete পেতে
chai চাই
chao চাও
chacchi চাচ্ছি
chay চায়
chaile চাইলে
lagbe লাগবে
lage লাগে
lagche লাগছে
likhbo লিখবো লিখব
likhi লিখি
likhe লিখে
likhte লিখতে
porbo পড়বো পড়ব
pori পড়ি
porte পড়তে
boshe বসে
boso বসো
thako থাকো
thaki থাকি
thakbo থাকবো থাকব
thake থাকে
thakte থাকতে
jani জানি
jano জানো
jante জানতে
bujhi বুঝি
bujhte বুঝতে
bujhechi বুঝেছি
bhabi ভাবি
bhabchi ভাবছি
bhabo ভাবো
shikhi শিখি
shikhbo শিখবো শিখব
shikhte শিখতে
korar করার
bolar বলার
dekhar দেখার
jawar যাওয়ার
jaoar যাওয়ার
khaoa খাওয়া
khawa খাওয়া
jaoa যাওয়া
jawa যাওয়া
paoa পাওয়া
pawa পাওয়া
deoa দেওয়া
dewa দেওয়া
neoa নেওয়া
newa নেওয়া
hoa হওয়া
howa হওয়া

# ---- বিশেষ্য: মানুষ ও সম্পর্ক
manush মানুষ
manus মানুষ
bondhu বন্ধু
bondhura বন্ধুরা
maa মা
ma মা
baba বাবা
bhai ভাই
bon বোন
apu আপু
didi দিদি
chele ছেলে
meye মেয়ে
bou বউ
shami স্বামী
stri স্ত্রী
shikkhok শিক্ষক
chhatro ছাত্র
chatro ছাত্র
chhatri ছাত্রী
chatri ছাত্রী
shomporko সম্পর্ক
somporko সম্পর্ক

# ---- বিশেষ্য: জায়গা ও জিনিস
bangla বাংলা
bangladesh বাংলাদেশ
bhasha ভাষা
basha ভাষা
desh দেশ
shohor শহর
shohore শহরে
gram গ্রাম
bari বাড়ি
ghor ঘর
school স্কুল
college কলেজ
dokan দোকান
bazar বাজার
rasta রাস্তা
nodi নদী
akash আকাশ
surjo সূর্য
chad চাঁদ
chand চাঁদ
phul ফুল
ful ফুল
gach গাছ
pakhi পাখি
kukur কুকুর
biral বিড়াল
goru গরু
mach মাছ
mangsho মাংস
dim ডিম
pani পানি
jol জল
bhat ভাত
ruti রুটি
cha চা
chaa চা
khabar খাবার
taka টাকা
poisha পয়সা
boi বই
khata খাতা
kolom কলম
mobile মোবাইল
kaj কাজ
kaaj কাজ
porashona পড়াশোনা
porasuna পড়াশুনা
shikkha শিক্ষা
sikkha শিক্ষা
shorkar সরকার
shomaj সমাজ
somaj সমাজ
rajniti রাজনীতি
kotha কথা
golpo গল্প
gaan গান
kobita কবিতা
chobi ছবি
khobor খবর
proshno প্রশ্ন
uttor উত্তর
shomosya সমস্যা
somossa সমস্যা
shomadhan সমাধান
sahajjo সাহায্য
shahajjo সাহায্য
chesta চেষ্টা
cheshta চেষ্টা
asha আশা
jibon জীবন
mon মন
shorir শরীর
matha মাথা
haat হাত
hat হাত
chokh চোখ
mukh মুখ

# ---- বিশেষণ
valo ভালো ভাল
bhalo ভালো ভাল
kharap খারাপ
sundor সুন্দর
shundor সুন্দর
notun নতুন
purano পুরনো পুরোনো
boro বড়
choto ছোট
thik ঠিক
vul ভুল
bhul ভুল
shotti সত্যি সত্য
sotti সত্যি সত্য
sotto সত্য
shukhi সুখী
sukhi সুখী
dukkho দুঃখ
dukkhito দুঃখিত

# ---- সম্ভাষণ ও ভদ্রতা
dhonnobad ধন্যবাদ
dhonyobad ধন্যবাদ
dhonnobaad ধন্যবাদ
shagotom স্বাগতম
sagotom স্বাগতম
shuvo শুভ
subho শুভ
shuvokamona শুভকামনা
shubhechha শুভেচ্ছা
shuvechha শুভেচ্ছা
abhinondon অভিনন্দন
nomoskar নমস্কার
onurodh অনুরোধ
odhikar অধিকার
khoma ক্ষমা
kkhoma ক্ষমা
maf মাফ
bhalobasha ভালোবাসা
valobasha ভালোবাসা
bhalobashi ভালোবাসি
valobashi ভালোবাসি
prem প্রেম
shanti শান্তি
shonti শান্তি

# ---- হ্যাঁ/না
hae হ্যাঁ
haa হ্যাঁ
ha হ্যাঁ
na না
accha আচ্ছা
achcha আচ্ছা


# ---- বিভাগ ও জেলা
dhaka ঢাকা
chattogram চট্টগ্রাম
chattagram চট্টগ্রাম
chittagong চট্টগ্রাম
chottogram চট্টগ্রাম
ctg চট্টগ্রাম
rajshahi রাজশাহী
rajshai রাজশাহী
khulna খুলনা
barishal বরিশাল
barisal বরিশাল
sylhet সিলেট
silet সিলেট
sylet সিলেট
rangpur রংপুর
rongpur রংপুর
mymensingh ময়মনসিংহ
moymonshingho ময়মনসিংহ
gazipur গাজীপুর
narayanganj নারায়ণগঞ্জ
narayangonj নারায়ণগঞ্জ
narsingdi নরসিংদী
norsingdi নরসিংদী
manikganj মানিকগঞ্জ
manikgonj মানিকগঞ্জ
munshiganj মুন্সিগঞ্জ
munshigonj মুন্সিগঞ্জ
tangail টাঙ্গাইল
kishoreganj কিশোরগঞ্জ
kishorgonj কিশোরগঞ্জ
faridpur ফরিদপুর
gopalganj গোপালগঞ্জ
gopalgonj গোপালগঞ্জ
madaripur মাদারীপুর
rajbari রাজবাড়ী
shariatpur শরীয়তপুর
shariyatpur শরীয়তপুর
coxsbazar কক্সবাজার
coxbazar কক্সবাজার
cumilla কুমিল্লা
comilla কুমিল্লা
kumilla কুমিল্লা
feni ফেনী
brahmanbaria ব্রাহ্মণবাড়িয়া
noakhali নোয়াখালী
lakshmipur লক্ষ্মীপুর
laxmipur লক্ষ্মীপুর
chandpur চাঁদপুর
rangamati রাঙামাটি
khagrachhari খাগড়াছড়ি
khagrachari খাগড়াছড়ি
bandarban বান্দরবান
bogura বগুড়া
bogra বগুড়া
pabna পাবনা
sirajganj সিরাজগঞ্জ
sirajgonj সিরাজগঞ্জ
natore নাটোর
naogaon নওগাঁ
chapainawabganj চাঁপাইনবাবগঞ্জ
joypurhat জয়পুরহাট
jashore যশোর
jessore যশোর
satkhira সাতক্ষীরা
bagerhat বাগেরহাট
narail নড়াইল
magura মাগুরা
jhenaidah ঝিনাইদহ
kushtia কুষ্টিয়া
chuadanga চুয়াডাঙ্গা
meherpur মেহেরপুর
bhola ভোলা
patuakhali পটুয়াখালী
pirojpur পিরোজপুর
jhalokathi ঝালকাঠি
jhalokati ঝালকাঠি
barguna বরগুনা
moulvibazar মৌলভীবাজার
maulvibazar মৌলভীবাজার
habiganj হবিগঞ্জ
habigonj হবিগঞ্জ
sunamganj সুনামগঞ্জ
sunamgonj সুনামগঞ্জ
dinajpur দিনাজপুর
kurigram কুড়িগ্রাম
gaibandha গাইবান্ধা
nilphamari নীলফামারী
lalmonirhat লালমনিরহাট
thakurgaon ঠাকুরগাঁও
panchagarh পঞ্চগড়
jamalpur জামালপুর
netrokona নেত্রকোণা
sherpur শেরপুর

# ---- ঢাকা ও অন্যান্য বড় এলাকা
savar সাভার
uttara উত্তরা
mirpur মিরপুর
dhanmondi ধানমন্ডি
gulshan গুলশান
banani বনানী
motijheel মতিঝিল
mohakhali মহাখালী
farmgate ফার্মগেট
badda বাড্ডা
rampura রামপুরা
mohammadpur মোহাম্মদপুর
tejgaon তেজগাঁও
jatrabari যাত্রাবাড়ী
keraniganj কেরানীগঞ্জ
tongi টঙ্গী
ashulia আশুলিয়া

# ---- দেশ ও বড় শহর
india ভারত ইন্ডিয়া
pakistan পাকিস্তান
nepal নেপাল
bhutan ভুটান
srilanka শ্রীলঙ্কা
china চীন
japan জাপান
korea কোরিয়া
malaysia মালয়েশিয়া
singapore সিঙ্গাপুর
saudi সৌদি
dubai দুবাই
qatar কাতার
kuwait কুয়েত
oman ওমান
america আমেরিকা
canada কানাডা
london লন্ডন
italy ইতালি
germany জার্মানি
australia অস্ট্রেলিয়া

# ---- ব্র্যান্ড ও অ্যাপ
facebook ফেসবুক
fb ফেসবুক
fesbuk ফেসবুক
whatsapp হোয়াটসঅ্যাপ
youtube ইউটিউব
instagram ইনস্টাগ্রাম
messenger মেসেঞ্জার
twitter টুইটার
linkedin লিংকডইন
tiktok টিকটক
telegram টেলিগ্রাম
gmail জিমেইল
viber ভাইবার
snapchat স্ন্যাপচ্যাট
netflix নেটফ্লিক্স
amazon অ্যামাজন
daraz দারাজ
pathao পাঠাও
uber উবার
bkash বিকাশ
nagad নগদ
rocket রকেট
grameenphone গ্রামীণফোন
robi রবি
banglalink বাংলালিংক
airtel এয়ারটেল
teletalk টেলিটক
foodpanda ফুডপান্ডা
samsung স্যামসাং
iphone আইফোন
windows উইন্ডোজ
wikipedia উইকিপিডিয়া
chatgpt চ্যাটজিপিটি

# ---- খাবার ও রান্না
biriyani বিরিয়ানি
tehari তেহারি
khichuri খিচুড়ি
bhorta ভর্তা
dal ডাল দল
torkari তরকারি
luchi লুচি
singara সিঙ্গারা
somosa সমোসা
misti মিষ্টি
mishti মিষ্টি
rosogolla রসগোল্লা
aam আম
kola কলা
lebu লেবু
aloo আলু
alu আলু
peyaj পেঁয়াজ
peaj পেঁয়াজ
morich মরিচ
lobon লবণ
chini চিনি
dudh দুধ
doi দই
tel তেল

# ---- রং, আবহাওয়া ও ঋতু
lal লাল
nil নীল
sobuj সবুজ
holud হলুদ
kalo কালো
shada সাদা
sada সাদা
rong রং
bristi বৃষ্টি
rod রোদ
thanda ঠান্ডা
gorom গরম
batash বাতাস
megh মেঘ
jhor ঝড়
shit শীত
grishmo গ্রীষ্ম
borsha বর্ষা
boshonto বসন্ত
hemonto হেমন্ত
shorot শরৎ

# ---- পরিবার, শরীর ও স্বাস্থ্য
poribar পরিবার
chacha চাচা
mama মামা
khala খালা
fufu ফুফু
dada দাদা
dadi দাদি
nana নানা
nani নানি
biye বিয়ে
ghum ঘুম
ghumano ঘুমানো
hashi হাসি
kanna কান্না
bhoy ভয়
rag রাগ
khushi খুশি
khusi খুশি
chinta চিন্তা
jor জোর জ্বর
jwor জ্বর
byatha ব্যথা
osukh অসুখ
oshudh ওষুধ
oshud ওষুধ
daktar ডাক্তার
doctor ডাক্তার
haspatal হাসপাতাল

# ---- যাতায়াত ও দৈনন্দিন
gari গাড়ি
rickshaw রিকশা
riksha রিকশা
launch লঞ্চ
train ট্রেন
thikana ঠিকানা
nam নাম
boyosh বয়স
chakri চাকরি
byabsha ব্যবসা
beton বেতন
bhara ভাড়া ভারা
dam দাম
kena কেনা
kinbo কিনবো কিনব
kinte কিনতে
bikri বিক্রি
hishab হিসাব
hisab হিসাব
bank ব্যাংক
byank ব্যাংক
dorkar দরকার
proyojon প্রয়োজন
subidha সুবিধা
shubidha সুবিধা
osubidha অসুবিধা
khola খোলা
bondho বন্ধ
nirapod নিরাপদ
taratari তাড়াতাড়ি
aste আস্তে
jolodi জলদি
dhire ধীরে
shobcheye সবচেয়ে
sobcheye সবচেয়ে
lomba লম্বা
mota মোটা
shopno স্বপ্ন
icche ইচ্ছে
icchha ইচ্ছা
ichchha ইচ্ছা
bharosa ভরসা
sadharon সাধারণ
bishesh বিশেষ

# ---- উৎসব, ধর্ম ও জাতীয় দিবস
eid ঈদ
mubarak মুবারক
ramadan রমজান
ramzan রমজান
roja রোজা
namaz নামাজ
puja পূজা
pohela পহেলা
boishakh বৈশাখ
falgun ফাল্গুন
ekushey একুশে
shaheed শহীদ
shadhinota স্বাধীনতা
bijoy বিজয়
muktijuddho মুক্তিযুদ্ধ
bangabandhu বঙ্গবন্ধু
jonmodin জন্মদিন
shubhoratri শুভরাত্রি
`;

  const WORDS = Object.create(null);
  for (const line of RAW.split('\n')) {
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    const parts = t.split(/\s+/);
    if (parts.length < 2) continue;
    WORDS[parts[0]] = parts.slice(1);
  }

  root.BVTPhoneticDict = WORDS;
  if (typeof module === 'object' && module.exports) module.exports = WORDS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
