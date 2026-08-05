const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public 폴더의 HTML, CSS, JS 파일들을 정적 파일로 제공합니다.
app.use(express.static(path.join(__dirname, 'public')));

// 메모리에 방(Room) 데이터와 플레이어 데이터를 임시로 저장합니다.
// 실제 서비스에서는 DB(Redis 등)를 사용하지만, 데모용으로는 메모리로 충분합니다.
const rooms = {}; 

io.on('connection', (socket) => {
    console.log(`[접속] 새로운 플레이어 연결됨: ${socket.id}`);

    // 1. 방 만들기 이벤트
    socket.on('createRoom', (playerData) => {
        // 4자리 무작위 방 코드 생성
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        socket.join(roomCode); // 소켓을 해당 방에 입장시킴
        
        // 플레이어 정보에 소켓 ID 부여 및 방장 설정
        const player = { ...playerData, id: socket.id, isHost: true, score: 0 };
        
        rooms[roomCode] = {
            code: roomCode,
            players: [player],
            status: 'waiting', // waiting, playing
        };

        // 방장에게 방 생성 성공을 알림
        socket.emit('roomJoined', { room: rooms[roomCode], me: player });
        console.log(`[방 생성] 방 코드: ${roomCode}, 방장: ${player.name}`);
    });

    // 2. 방 참가 이벤트
    socket.on('joinRoom', ({ code, playerData }) => {
        const roomCode = code.toUpperCase();
        const room = rooms[roomCode];

        if (!room) {
            socket.emit('errorMsg', '존재하지 않는 방입니다!');
            return;
        }
        if (room.status !== 'waiting') {
            socket.emit('errorMsg', '이미 게임이 시작된 방입니다!');
            return;
        }

        socket.join(roomCode);
        const player = { ...playerData, id: socket.id, isHost: false, score: 0 };
        room.players.push(player);

        socket.emit('roomJoined', { room: room, me: player });
        // 방에 있는 다른 모든 사람에게 플레이어 목록 업데이트 알림
        io.to(roomCode).emit('roomUpdated', room); 
        console.log(`[방 입장] ${player.name}님이 ${roomCode} 방에 입장함`);
    });

    // 방장이 게임 시작 버튼을 눌렀을 때
    socket.on('startGame', (roomCode) => {
        if(rooms[roomCode]) {
            rooms[roomCode].status = 'playing';
            // 서버가 게임 상태 관리를 전부 하기엔 복잡하므로, 
            // 방장(Host) 클라이언트가 계산한 게임 상태를 모든 클라이언트에 동기화하는 방식을 사용
            io.to(roomCode).emit('gameStarted');
        }
    });

    // 게임 상태 동기화 (방장이 계산한 라운드, 시간, 점수 등을 나머지 플레이어에게 덮어씌움)
    socket.on('syncGameState', ({ roomCode, gameState, players }) => {
        if(rooms[roomCode]) {
            rooms[roomCode].players = players; // 점수 등 업데이트
            // 방장을 제외한 다른 사람들에게 상태 전달 (broadcast)
            socket.to(roomCode).emit('gameStateSynced', { gameState, players });
        }
    });

    // 채팅 메시지 전송
    socket.on('chatMessage', ({ roomCode, message, isHint }) => {
        // 보낸 사람을 포함하여 방에 있는 모두에게 메시지 방송
        io.to(roomCode).emit('receiveChat', { senderId: socket.id, message, isHint });
    });

    // 시스템 메시지 전송 (누가 정답을 맞췄다 등)
    socket.on('systemMessage', ({ roomCode, message, type }) => {
        io.to(roomCode).emit('receiveSystemMessage', { message, type });
    });

    // 그리기 데이터 (좌표, 색상, 모드 등)
    socket.on('draw', ({ roomCode, drawData }) => {
        // 본인을 제외한 방 안의 다른 사람들에게 그리기 데이터 전송
        socket.to(roomCode).emit('drawUpdate', drawData);
    });

    // 캔버스 초기화
    socket.on('clearCanvas', (roomCode) => {
        socket.to(roomCode).emit('canvasCleared');
    });

    // 플레이어 연결 끊김 처리 (브라우저 종료 등)
    socket.on('disconnect', () => {
        console.log(`[종료] 플레이어 연결 끊김: ${socket.id}`);
        // 모든 방을 순회하며 나간 플레이어 제거
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                // 만약 방에 아무도 없으면 방 삭제
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                    console.log(`[방 삭제] ${roomCode} 방 소멸`);
                } else {
                    // 방장이 나갔다면, 다음 사람에게 방장 위임
                    if (!room.players.some(p => p.isHost)) {
                        room.players[0].isHost = true;
                    }
                    io.to(roomCode).emit('roomUpdated', room);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 캐치마인드 서버가 실행되었습니다!`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=================================`);
});