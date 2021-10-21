/**
 *
 * Reldens - Audio Manager
 *
 */

const { AudioConst } = require('../constants');
const { Logger, sc } = require('@reldens/utils');

class AudioManager
{

    constructor(props)
    {
        this.events = sc.getDef(props, 'events', false);
        if(!this.events){
            Logger.error('EventsManager undefined in ChatPack.');
        }
        this.globalAudios = sc.getDef(props, 'globalAudios', {});
        this.roomsAudios = sc.getDef(props, 'roomsAudios', {});
        this.categories = sc.getDef(props, 'categories', {});
        this.playerConfig = sc.getDef(props, 'playerConfig', {});
        this.playing = {};
        this.defaultAudioConfig = {
            mute: false,
            volume: 1,
            rate: 1,
            detune: 0,
            seek: 0,
            loop: true,
            delay: 0
        };
    }

    async setAudio(audioType, enabled)
    {
        await this.events.emit('reldens.setAudio', {
            audioManager: this,
            categoryKey: audioType,
            enabled
        });
        let category = this.categories[audioType];
        this.playerConfig[category.id] = enabled ? 1 : 0;
        if(!sc.hasOwn(this.playing, audioType)){
            return true;
        }
        let playOrStop = enabled ? 'play' : 'stop';
        // if is single track we will stop or play the last audio:
        if(category.single_audio && typeof this.playing[audioType][playOrStop] === 'function'){
            this.playing[audioType][playOrStop]();
            this.playing[audioType].mute = !enabled;
            return true;
        }
        // if is multi-track we will only stop all the audios but replay them only when the events require it:
        let audioTypesKeys = Object.keys(this.playing[audioType]);
        if(!category.single_audio && audioTypesKeys.length){
            for(let i of audioTypesKeys){
                let playingAudio = this.playing[audioType][i];
                if(playingAudio && typeof playingAudio.stop === 'function'){
                    if(!enabled){
                        playingAudio.stop();
                    }
                    playingAudio.mute = !enabled;
                }
            }
            return true
        }
        return false;
    }

    loadGlobalAudios(onScene, audiosDataCollection)
    {
        for(let audio of audiosDataCollection){
            let filesName = audio.files_name.split(',');
            let filesArr = [];
            for(let fileName of filesName){
                filesArr.push(AudioConst.AUDIO_BUCKET+'/'+fileName);
            }
            onScene.load.audio(audio.audio_key, filesArr);
        }
    }

    generateAudios(onScene, audiosDataCollection)
    {
        let generatedAudios = {};
        for(let audio of audiosDataCollection){
            generatedAudios[audio.audio_key] = this.generateAudio(onScene, audio);
        }
        return generatedAudios;
    }

    generateAudio(onScene, audio)
    {
        let soundConfig = Object.assign({}, this.defaultAudioConfig, (audio.config || {}));
        let audioInstance = onScene.sound.add(audio.audio_key, soundConfig);
        if(audio.markers && audio.markers.length > 0){
            for(let marker of audio.markers){
                let markerConfig = Object.assign({}, soundConfig, (marker.config || {}), {
                    name: marker.marker_key,
                    start: marker.start,
                    duration: marker.duration,
                });
                audioInstance.addMarker(markerConfig);
            }
        }
        return {data: audio, audioInstance};
    }

    findAudio(audioKey, sceneKey)
    {
        let roomAudio = this.findRoomAudio(audioKey, sceneKey);
        return roomAudio ? roomAudio : this.findGlobalAudio(audioKey);
    }

    findRoomAudio(audioKey, sceneKey)
    {
        if(!sc.hasOwn(this.roomsAudios, sceneKey)){
            this.roomsAudios[sceneKey] = {};
        }
        return this.findAudioInObjectKey(audioKey, this.roomsAudios[sceneKey]);
    }

    findGlobalAudio(audioKey)
    {
        return this.findAudioInObjectKey(audioKey, this.globalAudios);
    }

    findAudioInObjectKey(audioKey, audiosObject)
    {
        let objectKeys = Object.keys(audiosObject);
        if(sc.hasOwn(audiosObject, audioKey)){
            return {audio: audiosObject[audioKey], marker: false};
        }
        if(objectKeys.length){
            for(let i of objectKeys){
                let audio = audiosObject[i];
                if(sc.hasOwn(audio.audioInstance.markers, audioKey)){
                    return {audio, marker: audioKey};
                }
            }
        }
        return false;
    }

    addCategories(categories)
    {
        for(let category of categories){
            if(!sc.hasOwn(this.categories, category.category_key)){
                this.categories[category.category_key] = category;
            }
            if(!sc.hasOwn(this.playing, category.category_key)){
                this.playing[category.category_key] = {};
            }
        }
    }

    async loadAudiosInScene(audios, currentScene)
    {
        let newAudiosCounter = 0;
        for(let audio of audios){
            if(this.audioExistsInScene(audio.audio_key, currentScene) || !audio.files_name){
                if(!audio.files_name){
                    // Logger.error('Missing audio data:', audio);
                }
                continue;
            }
            let filesName = audio.files_name.split(',');
            let filesArr = [];
            for(let fileName of filesName){
                filesArr.push(AudioConst.AUDIO_BUCKET+'/'+fileName);
            }
            currentScene.load.audio(audio.audio_key, filesArr).on('complete', async () => {
                if(!sc.hasOwn(this.roomsAudios, currentScene.key)){
                    this.roomsAudios[currentScene.key] = {};
                }
                this.roomsAudios[currentScene.key][audio.audio_key] = this.generateAudio(currentScene, audio);
                newAudiosCounter++;
                if(newAudiosCounter === audios.length){
                    await currentScene.gameManager.events.emit(
                        'reldens.allAudiosLoaded',
                        this,
                        audios,
                        currentScene,
                        audio
                    );
                }
                await currentScene.gameManager.events.emit(
                    'reldens.audioLoaded',
                    this,
                    audios,
                    currentScene,
                    audio
                );
            });
        }
        currentScene.load.start();
    }

    removeAudiosFromScene(audios, currentScene)
    {
        if(!sc.hasOwn(currentScene.sound, 'sounds') || !sc.isArray(currentScene.sound.sounds)){
            return false;
        }
        for(let audio of audios){
            for(let sound of currentScene.sound.sounds){
                if(sound.key === audio.audio_key){
                    if(sound.isPlaying){
                        sound.stop();
                    }
                    delete currentScene.sound.remove(sound);
                    return true;
                }
            }
        }
        return false;
    }

    audioExistsInScene(audioKey, currentScene)
    {
        if(!sc.hasOwn(currentScene.sound, 'sounds') || !sc.isArray(currentScene.sound.sounds)){
            return false;
        }
        for(let sound of currentScene.sound.sounds){
            if(sound.key === audioKey){
                return true;
            }
        }
        return false;
    }

    updateDefaultConfig(defaultAudioConfig)
    {
        if(defaultAudioConfig){
            Object.assign(this.defaultAudioConfig, defaultAudioConfig);
        }
    }

    async processUpdateData(message, room, gameManager)
    {
        if(message.playerConfig){
            this.playerConfig = message.playerConfig;
        }
        if(message.categories){
            this.addCategories(message.categories);
            await this.events.emit(
                'reldens.audioManagerUpdateCategoriesLoaded',
                this,
                room,
                gameManager,
                message
            );
        }
        if(message.audios.length > 0){
            let currentScene = gameManager.gameEngine.scene.getScene(room.name);
            await this.loadAudiosInScene(
                message.audios,
                currentScene
            );
            await this.events.emit(
                'reldens.audioManagerUpdateAudiosLoaded',
                this,
                room,
                gameManager,
                message
            );
        }
    }

    async processDeleteData(message, room, gameManager)
    {
        if(message.audios.length > 0){
            let currentScene = gameManager.gameEngine.scene.getScene(room.name);
            this.removeAudiosFromScene(
                message.audios,
                currentScene
            );
            await this.events.emit(
                'reldens.audioManagerDeleteAudios',
                this,
                room,
                gameManager,
                message
            );
        }
    }

}

module.exports.AudioManager = AudioManager;
