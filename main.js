// canvas とクォータニオンをグローバル変数とする
let canvas;
let q = new qtnIV();
//let qt = q.identity(q.create());
let disp_x = 0;
let disp_y = 0;
const camRadius = 20; // 原点から初期カメラ位置の奥行距離
let mouseOddClick = false;

/*
// mousedownイベントに登録する処理
function mouseDown(e){
    const cw = canvas.width;
	const ch = canvas.height;
	const wh = 1 / Math.sqrt(cw * cw + ch * ch);
	let x = e.clientX - canvas.offsetLeft - cw * 0.5;
	let y = e.clientY - canvas.offsetTop - ch * 0.5;
	const sq = Math.sqrt(x * x + y * y);
    let invSq;
	const r = sq * 2.0 * Math.PI * wh;
	if(sq !== 0){
		invSq = 1 / sq;
		x *= invSq;
		y *= invSq;
	}
	q.rotate(r, [x, y, 0], qt);
}
*/

// mousemoveイベントに登録する処理
function mouseMove(e){
    const cw = canvas.width;
	const ch = canvas.height;
	//const wh = 1 / Math.sqrt(cw * cw + ch * ch);
	disp_x = (e.clientX - canvas.offsetLeft - cw * 0.5) / cw; // camvasの右端にマウスが来ると、そのx座標は1
	disp_y = -(e.clientY - canvas.offsetTop - ch * 0.5) / ch; // 画面上のy軸は下向きだからマイナス倍して上向きに
    disp_x *= camRadius;
    disp_y *= camRadius;
}

function mouseClick(e){
    mouseOddClick = !mouseOddClick;
}

document.addEventListener('DOMContentLoaded', function () {
    // HTMLからcanvas要素を取得する
    canvas = document.getElementById('canvas');
    canvas.width = 1500;
    canvas.height = 1000;

    // canvasのmousemoveイベントに処理を登録
    canvas.addEventListener('mousemove', mouseMove, true);
    canvas.addEventListener('click', mouseClick, true);


    // canvas要素からwebglコンテキストを取得する
    const gl = canvas.getContext('webgl');
    // WebGLコンテキストが取得できたかどうか調べる
    if (!gl) {
        alert('webgl not supported!');
        return;
    }

    // エレメントへの参照を取得
	const ePoints    = document.getElementById('Points');
	const eLines     = document.getElementById('lines');
	const eLineStrip = document.getElementById('line_strip');
	const eLineLoop  = document.getElementById('line_loop');
	const ePointSize = document.getElementById('point_size');
	
    // 点の最大ピクセル数をコンソールに出力
	var pointSizeRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
	console.log('pointSizeRange:' + pointSizeRange[0] + ' to ' + pointSizeRange[1]);
	

    // 頂点シェーダとフラグメントシェーダの生成
    const v_shader = create_shader('vertexShader');
    const f_shader = create_shader('fragmentShader');
    
    // プログラムオブジェクトの生成とリンク
    const prg = create_program(v_shader, f_shader);
    
    let attLocation = new Array(2);
    // attributeLocationの取得、positionが何番目のAttributeかを返す
    attLocation[0] = gl.getAttribLocation(prg, 'position');
    attLocation[1] = gl.getAttribLocation(prg, 'color');
    attLocation[2] = gl.getAttribLocation(prg, 'normal');
    
    
    
    const attStride = new Array(2);
    // attribute1の要素数(この場合は xyz の3要素)
    attStride[0] = 3;
    attStride[1] = 4;
    attStride[2] = 3;
    
    
    


    let uniLocation = new Array();
    // uniformLocationの取得　prgオブジェクトにあるシェーダのuniform変数’mvpMatrix’がuniform変数の中で何番目のものかを取得
    uniLocation[0] = gl.getUniformLocation(prg, 'mvpMatrix');
    uniLocation[1] = gl.getUniformLocation(prg, 'pointSize');
    uniLocation[2] = gl.getUniformLocation(prg, 'mMatrix');
    uniLocation[3] = gl.getUniformLocation(prg, 'invMatrix');
    uniLocation[4] = gl.getUniformLocation(prg, 'lightPosition');
    uniLocation[5] = gl.getUniformLocation(prg, 'eyeDirection');
    uniLocation[6] = gl.getUniformLocation(prg, 'ambientColor');

    
    // 各種行列の生成と初期化
    const m = new matIV();
    let mMatrix = m.identity(m.create());
    let vMatrix = m.identity(m.create());
    let pMatrix = m.identity(m.create());
    let tmpMatrix = m.identity(m.create());
    let mvpMatrix = m.identity(m.create());
    let invMatrix = m.identity(m.create());

    // 点光源の位置
    const lightPosition = [0.0, 0.0, 10.0];
    // 環境光の色
    const ambientColor = [0.1, 0.1, 0.1, 1.0];
    
    

    // 各種フラグを有効化する
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.enable(gl.BLEND);

    // カウンタ
    let count = 0;

    let accumQt = q.identity(q.create());
    const camPosition = [0.0, 0.0, camRadius];
    const camUpDirection = [0.0, 1.0, 0.0];
	

    // 恒常ループ
    (function(){
        // canvasを初期化
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
        // 視点ベクトル
        const eyeDirection = camPosition;

		// カウンタからラジアンを算出
		count++;
		const rad = (count % 360) * Math.PI / 180;
		
		// クォータニオンを行列に適用
		//const qMatrix = m.identity(m.create());
		//q.toMatIV(accumQt, qMatrix);
        if(!mouseOddClick){
            // 回転のための軸ベクトルを算出
            let dispPosition = [0, 0, 0];
            // マウス座標に現在までの回転を加えることで、カメラから見たマウスの座標を算出
            q.toVecIII([disp_x, disp_y, 0], accumQt, dispPosition);
            // カメラ座標とマウス座標から回転軸としての法線ベクトルを計算
            const axisVec = create_axis(camPosition, dispPosition, [0, 0, 0]);
            let qt = q.identity(q.create());
            //画面が正方形のとき、画面の四隅にマウスがあるときに係数の速さで回転する。
            const rotateSpeed = 0.05 * Math.sqrt(disp_x ** 2 + disp_y ** 2)/(Math.sqrt(2) * camRadius);
            q.rotate(rotateSpeed, axisVec, qt);
            q.multiply(qt, accumQt, accumQt);
            q.toVecIII(camPosition, qt, camPosition);
            q.toVecIII(camUpDirection, qt, camUpDirection);
        }

		// ビュー×プロジェクション座標変換行列
		m.lookAt(camPosition, [0, 0, 0], camUpDirection, vMatrix);
		m.perspective(45, canvas.width / canvas.height, 0.1, 100, pMatrix);
		m.multiply(pMatrix, vMatrix, tmpMatrix);
		m.identity(mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);

        let torusData;
        if(!mouseOddClick){
            torusData = torus(64, 64, 0.5, 1.5);
        }else{
            torusData = torus(64, 64, 0.5, 1.5, 1);
        }
        //const stripedSphereData = stripedSphere(2, 51, 20);
        const pointSphere = sphere(16, 16, 1.0);

        // トーラス用VBOの生成
        const tPos = create_vbo(torusData.position);
        const tNor = create_vbo(torusData.normal);
        const tCol = create_vbo(torusData.color);
        const tVBOList = [tPos, tCol, tNor];
        const tIBO = create_ibo(torusData.index);

        // 点のVBO生成
        const pPos = create_vbo(pointSphere.position);
        const pCol = create_vbo(pointSphere.color);
        const pVBOList = [pPos, pCol, pPos];
        // トーラスのVBOとIBOをセット
        set_attribute(tVBOList, attLocation, attStride);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIBO);

        // uniform変数の登録と描画
		gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
		gl.uniformMatrix4fv(uniLocation[2], false, mMatrix);
		gl.uniformMatrix4fv(uniLocation[3], false, invMatrix);
		gl.uniform3fv(uniLocation[4], lightPosition);
		gl.uniform3fv(uniLocation[5], eyeDirection);
		gl.uniform4fv(uniLocation[6], ambientColor);
		gl.drawElements(gl.TRIANGLES, torusData.index.length, gl.UNSIGNED_SHORT, 0);



		
		// 点のサイズをエレメントから取得
		const pointSize = ePointSize.value / 10;
        // 線のプリミティブタイプを判別
		let lineOption = 0;
		if(ePoints.checked){lineOption = gl.POINTS;}
		if(eLines.checked){lineOption = gl.LINES;}
		if(eLineStrip.checked){lineOption = gl.LINE_STRIP;}
		if(eLineLoop.checked){lineOption = gl.LINE_LOOP;}

		// 点を描画
		set_attribute(pVBOList, attLocation, attStride);
		m.identity(mMatrix);
        m.translate(mMatrix, [camRadius/3 * Math.cos(rad), camRadius/8 * Math.cos(rad), camRadius/3 * Math.sin(rad)], mMatrix);
		m.multiply(tmpMatrix, mMatrix, mvpMatrix);
        m.inverse(mMatrix, invMatrix);

		gl.uniformMatrix4fv(uniLocation[0], false, mvpMatrix);
		gl.uniform1f(uniLocation[1], pointSize);
        gl.uniformMatrix4fv(uniLocation[3], false, invMatrix);
		gl.drawArrays(lineOption, 0, pointSphere.position.length / 3);
		

        gl.flush();
		
		// ループのために再帰呼び出し
		setTimeout(arguments.callee, 1000 / 30);
    })();


    // シェーダを生成する関数
    function create_shader(id){
        // シェーダを格納する変数
        let shader;
        
        // HTMLからscriptタグへの参照を取得
        let scriptElement = document.getElementById(id);
        
        // scriptタグが存在しない場合は抜ける
        if(!scriptElement){return;}
        
        // scriptタグのtype属性をチェック
        switch(scriptElement.type){
            
            // 頂点シェーダの場合
            case 'x-shader/x-vertex':
                shader = gl.createShader(gl.VERTEX_SHADER);
                break;
                
            // フラグメントシェーダの場合
            case 'x-shader/x-fragment':
                shader = gl.createShader(gl.FRAGMENT_SHADER);
                break;
            default :
                return;
        }
        
        // 生成されたシェーダにソースを割り当てる
        gl.shaderSource(shader, scriptElement.text);
        
        // シェーダをコンパイルする
        gl.compileShader(shader);
        
        // シェーダが正しくコンパイルされたかチェック
        if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
            
            // 成功していたらシェーダを返して終了
            return shader;
        }else{
            
            // 失敗していたらエラーログをアラートする
            alert(gl.getShaderInfoLog(shader));
        }
    }

    // プログラムオブジェクトを生成しシェーダをリンクする関数
    // プログラムオブジェクトとは、頂点シェーダからフラグメントシェーダ、またWebGLプログラムと各シェーダとのデータのやり取りを管理するオブジェクト
    function create_program(vs, fs){
        // プログラムオブジェクトの生成
        let program = gl.createProgram();
        
        // プログラムオブジェクトにシェーダを割り当てる
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        
        
        // シェーダをリンク
        gl.linkProgram(program);
        
        // シェーダのリンクが正しく行なわれたかチェック
        if(gl.getProgramParameter(program, gl.LINK_STATUS)){
        
            // 成功していたらプログラムオブジェクトを有効にする
            gl.useProgram(program);
            
            // プログラムオブジェクトを返して終了
            return program;
        }else{
            
            // 失敗していたらエラーログをアラートする
            alert(gl.getProgramInfoLog(program));
        }
    }

    // VBOを生成する関数
    // 頂点バッファは頂点に関する情報を保存できる記憶領域であり、ここに転送されたデータが、紐づけられたattribute変数に渡される
    function create_vbo(data){
        // バッファオブジェクトの生成
        let vbo = gl.createBuffer();
        
        // WebGLにバッファをバインドする。こうすることで、バッファを（WebGLから？）操作できる
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        
        // バッファにデータをセット
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        
        // バッファのバインドを無効化。WebGLにバインドできるバッファは一度につき一つだけだから。
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        // 生成した VBO を返して終了
        return vbo;
    }

    // VBOをバインドし登録する関数
    function set_attribute(vbo, attL, attS){
        // 引数として受け取った配列を処理する
        for(let i in vbo){
            // WebGLにVBOをバインド
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);

            // attribute属性を有効にする
            gl.enableVertexAttribArray(attL[i]);

            // attribute属性を登録、VBOからシェーダにデータを渡す
            gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);
        }
    }

    // IBOを生成する関数
    function create_ibo(data){
        // バッファオブジェクトの生成
        const ibo = gl.createBuffer();

        // バッファをバインドする
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

        // バッファにデータをセット
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);

        // バッファのバインドを無効化
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // 生成したIBOを返して終了
        return ibo;
    }

    // トーラスのモデルデータを生成する関数
    function torus(row, column, irad, orad, mouseEffect, color){
        let pos = new Array();
        let nor = new Array();
        let col = new Array(); 
        let idx = new Array();
        for(let i = 0; i <= row; i++)
        {
            // 輪を作る
            const r = 2 * Math.PI  * i / row; // 半径1の円のラジアン
            const rr = Math.cos(r);           // x座標
            const ry = Math.sin(r);           // y座標
            for(let ii = 0; ii <= column; ii++)
            {
                // 管を作る
                const tr = 2 * Math.PI * ii / column;
                let tx = (rr * irad + orad) * Math.cos(tr);
                const ty = ry * irad;
                const tz = (rr * irad + orad) * Math.sin(tr);
                const rx = rr * Math.cos(tr);       // 頂点Aの法線は、トーラスを頂点Aを含むよう輪切りし、
                const rz = rr * Math.sin(tr);       // その中心を原点とした時の、頂点Aの座標に一致するからこの計算で良い。
                if(color)
                {
                    var tc = color;
                }
                else
                {
                    tc = hsva(360 / column * ii, 1, 1, 1);
                }
                pos.push(tx, ty, tz);
                nor.push(rx, ry, rz);
                col.push(tc[0], tc[1], tc[2], tc[3]); 
            }
        }
        for(i = 0; i < row; i++)
        {
            for(ii = 0; ii < column; ii++)
            {
                r = (column + 1) * i + ii;
                idx.push(r, r + column + 1, r + 1);
                idx.push(r + column + 1, r + column + 2, r + 1);
            }
        }
        return {position: pos, normal: nor, color: col, index: idx};
    }

    function hsva(h, s, v, a){
        if(s > 1 || v > 1 || a > 1){return;}
        const th = h % 360;
        const i = Math.floor(th / 60);
        const f = th / 60 - i;
        const m = v * (1 - s);
        const n = v * (1 - s * f);
        const k = v * (1 - s * (1 - f));
        const color = new Array();
        if(!s > 0 && !s < 0){
            color.push(v, v, v, a); 
        } else {
            const r = new Array(v, n, m, m, k, v);
            const g = new Array(k, v, v, n, m, m);
            const b = new Array(m, m, k, v, v, n);
            color.push(r[i], g[i], b[i], a);
        }
        return color;
    }

    // 縞模様の球体を自作
    function stripedSphere(radius, frequency, roundness)
    {
        const pos = new Array();
        const nor = new Array();
        const col = new Array();
        const idx = new Array();
        for(let i = 1; i < frequency; i++)
        {
            const y_ratio = parseFloat(i) / frequency;  // 0<y_ration<1をとるy座標
            const y = 2.0 * radius * y_ratio;           // 0<y<2radius
            const y_radius = Math.sqrt(radius * radius - (radius - y) * (radius - y));
            for(let ii = 0; ii <= roundness; ii++)
            {
                const circle = 2 * Math.PI * ii / roundness;
                const tx = y_radius * Math.cos(circle);
                const ty = y - radius;
                const tz = y_radius * Math.sin(circle);
                pos.push(tx, ty, tz);
                nor.push(tx, ty, tz);  // このモデルは球だから、法線はこれで良い
                const tc = hsva(360 / roundness * ii, 1, 1, 1);
                col.push(tc[0], tc[1], tc[2], tc[3]);
            }
        }
        
        for(let i = 0; i < (frequency) / 2; i++)
        {
            for(let ii = 0; ii < roundness; ii++)
            {
                r = ii + 2 * i * (roundness + 1);
                idx.push(r, r + roundness + 1, r + roundness + 2);
                idx.push(r, r + roundness + 2, r + 1);    
            }
        }
        return {position: pos, normal: nor, color: col, index: idx};

    }

    // 球体を生成する関数
    function sphere(row, column, rad, color){
        let pos = new Array(), nor = new Array(),
            col = new Array(), idx = new Array();
        for(let i = 0; i <= row; i++){
            const r = Math.PI / row * i;
            const ry = Math.cos(r);
            const rr = Math.sin(r);
            for(let ii = 0; ii <= column; ii++){
                const tr = Math.PI * 2 / column * ii;
                const tx = rr * rad * Math.cos(tr);
                const ty = ry * rad;
                const tz = rr * rad * Math.sin(tr);
                const rx = rr * Math.cos(tr);
                const rz = rr * Math.sin(tr);
                if(color){
                    var tc = color;
                }else{
                    tc = hsva(360 / row * i, 1, 1, 1);
                }
                pos.push(tx, ty, tz);
                nor.push(rx, ry, rz);
                col.push(tc[0], tc[1], tc[2], tc[3]);
            }
        }
        r = 0;
        for(i = 0; i < row; i++){
            for(ii = 0; ii < column; ii++){
                r = (column + 1) * i + ii;
                idx.push(r, r + 1, r + column + 2);
                idx.push(r, r + column + 2, r + column + 1);
            }
        }
        return {position : pos, normal : nor, color : col, index : idx};
    }

    // テクスチャを生成する関数
	function create_texture(source, index){
		// イメージオブジェクトの生成
		const img = new Image();
		
		// データのオンロードをトリガーにする
		img.onload = function(){
			// テクスチャオブジェクトの生成
			const tex = gl.createTexture();
			
			// テクスチャをバインドする
			gl.bindTexture(gl.TEXTURE_2D, tex);
			
			// テクスチャへイメージを適用
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			
			// ミップマップを生成
			gl.generateMipmap(gl.TEXTURE_2D);
			
			// テクスチャのバインドを無効化
			gl.bindTexture(gl.TEXTURE_2D, null);
			
			// 生成したテクスチャを変数に代入
			switch(index){
				case 0:
					texture0 = tex;
					break;
				case 1:
					texture1 = tex;
					break;
				default:
					break;
			}
		};
		
		// イメージオブジェクトのソースを指定
		img.src = source;
	}

    // 法線ベクトルを返す関数
    function create_axis(pos1, pos2, originPos){
        const vec2 = [(pos2[0] - pos1[0]), (pos2[1] - pos1[1]), (pos2[2] - pos1[2])];
        const vec3 = [(originPos[0] - pos1[0]), (originPos[1] - pos1[1]), (originPos[2] - pos1[2])];
        const axisVec = [(vec2[1] * vec3[2] - vec2[2] * vec3[1]),
                        (vec2[2] * vec3[0] - vec2[0] * vec3[2]),
                        (vec2[0] * vec3[1] - vec2[1] * vec3[0])];
        const vecLen = Math.sqrt(axisVec[0] ** 2 + axisVec[1] ** 2 + axisVec[2] ** 2);
        //console.log(pos2[0] - pos1[0]);
        
        //console.log(axisVec);
        //console.log(axisVec/vecLen);
        if(vecLen !== 0){
            return [axisVec[0]/vecLen, axisVec[1]/vecLen, axisVec[2]/vecLen];
        }else{
            return [0, 0, 0];
        }
    }
});