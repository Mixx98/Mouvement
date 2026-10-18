/* Unedited screenshots, displayed through a crop with HTML annotations on top. */
(function(root){
  const home='assets/guide/home-',play='assets/guide/play-',volume='assets/guide/volume-';
  const shot=(image,crop,focus,top=false)=>({image,crop,focus,top});
  const shots={
    welcome:{location:'첫 화면 가운데',label:'이 버튼을 눌러 소리를 켜요',desktop:shot(home+'desktop.jpg',[500,580,480,260],[646,730,188,48]),mobile:shot(home+'mobile.jpg',[20,380,350,210],[103,480.5,184,48])},
    move:{location:'화면 전체의 음정 칸',label:'이 영역을 움직이면 연주돼요',desktop:shot(play+'desktop.jpg',[480,300,520,260],[540,345,370,120]),mobile:shot(play+'mobile.jpg',[20,160,350,220],[50,190,260,110])},
    words:{location:'화면 위쪽 · 글로 연주',label:'누르면 글쓰기 창이 열려요',desktop:shot(home+'desktop.jpg',[1040,0,420,210],[1123,31.5,108,49]),mobile:shot(home+'mobile.jpg',[170,0,220,170],[224.4,26.5,71.3,37])},
    sounds:{location:'화면 위쪽 · 악기 이름',label:'누르면 악기·분위기를 골라요',desktop:shot(home+'desktop.jpg',[1040,0,420,210],[1244,30.5,141,51]),mobile:shot(home+'mobile.jpg',[170,0,220,170],[300.7,26,74.3,38])},
    band:{location:'화면 아래쪽 · BGM과 합주',label:'누르면 반주가 시작돼요',desktop:shot(home+'desktop.jpg',[1070,1032,390,220],[1192,1183.5,89.3,43],true),mobile:shot(home+'mobile.jpg',[130,640,260,204],[183,783,84,43],true)},
    volume:{location:'화면 아래쪽 · 스피커',label:'슬라이더를 움직여 음량 조절',desktop:shot(volume+'desktop.jpg',[1160,1015,300,230],[1207,1127,174,22],true),mobile:shot(volume+'mobile.jpg',[120,625,270,210],[158,726.2,174,22],true)}
  };
  function layout(shot,mobile){const [x,y,w,h]=shot.crop,[fx,fy,fw,fh]=shot.focus,[sw,sh]=mobile?[390,844]:[1480,1252];return {ratio:w/h,imageWidth:sw/w*100,imageLeft:-x/w*100,imageTop:-y/h*100,focusLeft:(fx-x)/w*100,focusTop:(fy-y)/h*100,focusWidth:fw/w*100,focusHeight:fh/h*100,sourceWidth:sw,sourceHeight:sh};}
  const api={shots,layout};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GuideShots=api;
})(globalThis);
