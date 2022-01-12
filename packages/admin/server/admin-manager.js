/**
 *
 * Reldens - AdminManager
 *
 */

const { DriverDatabase } = require('./driver-database');
const { DriverResource } = require('./driver-resource');
const { AdminTranslations } = require('./admin-translations');
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const { sc } = require('@reldens/utils');

class AdminManager
{

    constructor(props)
    {
        this.app = props.app;
        this.config = props.config;
        this.databases = sc.get(props, 'databases', []);
        this.translations = sc.get(props, 'translations', {});
        this.router = false;
        this.adminJs = false;
        this.useSecureLogin = false;
        this.authenticateCallback = sc.get(props, 'authenticateCallback', () => { return true; });
    }

    setupAdmin()
    {
        AdminJS.registerAdapter({
            Database: DriverDatabase,
            Resource: DriverResource
        });
        this.rootPath = (process.env.ADMIN_ROUTE_PATH || '/reldens-admin');
        let adminJsConfig = {
            databases: this.databases,
            rootPath: this.rootPath,
            logoutPath: this.rootPath+'/logout',
            loginPath: this.rootPath+'/login',
            branding: {
                companyName: 'Reldens - Administration Panel',
                softwareBrothers: false,
                logo: '/assets/web/reldens-your-logo-mage.png',
            },
            locale: {
                translations: AdminTranslations.appendTranslations(this.translations)
            },
            assets: {
                styles: ['/css/reldens-admin.css'],
            },
            dashboard: {
                handler: () => {
                    return { manager: this }
                },
                component: AdminJS.bundle('./dashboard-component')
            },
        };
        this.adminJs = new AdminJS(adminJsConfig);
        this.router = this.createRouter();
        this.app.use(this.adminJs.options.rootPath, this.router);
    }

    createRouter()
    {
        return !this.useSecureLogin ? AdminJSExpress.buildRouter(this.adminJs)
            : AdminJSExpress.buildAuthenticatedRouter(this.adminJs, {
                authenticate: this.authenticateCallback,
                cookiePassword: (process.env.ADMIN_COOKIE_PASSWORD || 'secret-password-to-secure-the-admin-cookie')
            }
        );
    }

    static prepareResources(rawResources)
    {
        let rawResourcesKeys = Object.keys(rawResources);
        if(!rawResources || 0 === rawResourcesKeys.length){
            return [];
        }
        let registeredResources = [];
        for(let i of rawResourcesKeys){
            let rawResource = rawResources[i];
            let objectionDriverResource = {
                resource: new DriverResource(rawResource.rawEntity, rawResource.config),
                id: () => {
                    return rawResource.rawEntity.tableName();
                },
                options: {
                    navigation: sc.hasOwn(rawResource.config, 'parentItemLabel') ? {
                        name: rawResource.config.parentItemLabel,
                        icon: rawResource.config.icon || 'List'
                    } : null,
                    listProperties: rawResource.config.listProperties || [],
                    showProperties: rawResource.config.showProperties || [],
                    filterProperties: rawResource.config.filterProperties || [],
                    editProperties: rawResource.config.editProperties || [],
                    properties: rawResource.config.properties || [],
                    sort: sc.get(rawResource.config, 'sort', null)
                },
                features: sc.get(rawResource.config, 'features', [])
            };
            registeredResources.push(objectionDriverResource);
        }
        return registeredResources;
    }

}

module.exports.AdminManager = AdminManager;
