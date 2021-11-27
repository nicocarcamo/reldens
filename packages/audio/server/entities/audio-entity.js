/**
 *
 * Reldens - AudioEntity
 *
 */

const { AdminEntityProperties } = require('../../../admin/server/admin-entity-properties');
const { uploadFileFeature } = require('../../../admin/server/upload-file/upload-file.feature');
const { AdminLocalProvider } = require('../../../admin/server/upload-file/admin-local-provider');
const { AudioHotPlugCallbacks } = require('../audio-hot-plug-callbacks');
const { MimeTypes } = require('../../../admin/server/upload-file/mime-types');
const { AudioConst } = require('../../constants');
const { sc } = require('@reldens/utils');

class AudioEntity extends AdminEntityProperties
{

    static propertiesConfig(extraProps, projectConfig)
    {
        let properties = {
            id: {},
            audio_key: {
                isTitle: true,
                isRequired: true
            },
            files_name: {
                isRequired: true,
                isArray: true
            },
            uploadedFile: {
                isVirtual: true
            },
            config: {},
            room_id: {
                type: 'reference',
                reference: 'rooms'
            },
            category_id: {
                type: 'reference',
                reference: 'audio_categories'
            },
            enabled: {
                type: 'boolean'
            }
        };

        let arrayColumns = {files_name: {splitBy: ','}};

        let showProperties = Object.keys(properties);
        let listProperties = [...showProperties];
        let filterProperties = [...showProperties];
        let editProperties = [...showProperties];

        showProperties = sc.removeFromArray(showProperties, ['files_name']);
        listProperties = sc.removeFromArray(listProperties, ['files_name', 'config']);
        filterProperties = sc.removeFromArray(filterProperties, ['uploadedFile']);
        editProperties = sc.removeFromArray(editProperties, ['id', 'files_name']);

        let bucket = AdminLocalProvider.joinPath(projectConfig.bucketFullPath, 'assets', 'audio');
        let features = [
            uploadFileFeature({
                provider: new AdminLocalProvider({
                    bucket: bucket
                }),
                properties: {
                    file: 'uploadedFile',
                    key: 'files_name'
                },
                multiple: true,
                uploadPath: (record, filename) => {
                    return `${filename}`;
                },
                validation: {
                    mimeTypes: MimeTypes.audio
                },
            })
        ];

        let callbacks = {
            // @NOTE: we create audio files with this callback because the file_name update happens here when we use
            // the upload plugin.
            update: AudioHotPlugCallbacks.updateCallback(projectConfig, bucket),
            beforeDelete: AudioHotPlugCallbacks.beforeDeleteCallback(projectConfig, bucket)
        };

        return Object.assign({
            listProperties,
            showProperties,
            filterProperties,
            editProperties,
            properties,
            features,
            arrayColumns,
            bucketPath: '/'+AudioConst.AUDIO_BUCKET+'/',
            callbacks
        }, extraProps);
    }

}

module.exports.AudioEntity = AudioEntity;
