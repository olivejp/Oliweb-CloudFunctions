import MessagingDevicesResponse = admin.messaging.MessagingDevicesResponse;
import ServerValue = admin.database.ServerValue;

const functions = require('firebase-functions');
import * as admin from "firebase-admin";

try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export const DOMAIN_CLOUD_FUNCTION: string = 'cloudfunctions';

export const PARAM_SANS_PHOTO_NB_JOUR_AV_RELANCE: string = 'sans_photo_nb_jour_avant_relance';
export const PARAM_SANS_PHOTO_NB_JOUR_AP_RELANCE: string = 'sans_photo_nb_jour_apres_relance';

export function daysInMilliseconds(days: number): number {
    const nb_milliseconds_in_one_day = 86400000;
    return days * nb_milliseconds_in_one_day;
}

export function getParams(domain: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
        db.ref('params').child(domain).child(key).once('value').then(
            (data) => {
                resolve(data.val());
            }, (error) => {
                reject(error);
            }
        );
    });
}

export function getServerTimestamp(): Promise<number> {
    const nowReference = db.ref('timestamp').child('now');
    return new Promise((resolve, reject) => {
        nowReference.set(ServerValue.TIMESTAMP, function (error) {
            if (error) {
                reject(error);
            } else {
                nowReference.once('value').then(
                    (data) => {
                        resolve(data.val());
                    }, (error1) => {
                        reject(error1);
                    }
                );
            }
        }).catch(reason => reject(new Error(reason)))
    });
}

/**
 * Méthode qui permet d'envoyer une/des notification(s)
 *
 * @param tokens: string | string[] = Liste des tokens de device à qui nous voulons envoyer la notification
 * @param title: string = Titre de la notification
 * @param body: string = Message de la notification
 * @param tag: string = Tag de la notif
 * @param data: any = Ensemble des datas attachées à la notification
 */
export function sendNotification(tokens: string[], title: string, body: string, tag: string, data: any): Promise<MessagingDevicesResponse> {
    const payload = {
        data: data,
        notification: {
            title: title,
            body: body,
            tag: tag
        }
    };
    return admin.messaging().sendToDevice(tokens, payload);
}


/**
 * Va lire dans Firebase database la liste des ids utilisateur et va récupérer pour chacun d'eux son tokenDevice.
 * Renverra une promesse avec un tableau contenant tous les tokens des utilisateurs
 *
 * @param usersIds : string[] = Liste des ids des utilisateurs dont on veut les tokens
 * @returns {Promise<string[]>} Promesse contenant le tableau des tokens
 */
export function getTokens(usersIds): Promise<string[]> {
    const promiseArray: Array<Promise<string>> = [];
    for (const userId of usersIds) {
        const promesse: Promise<string> = new Promise<string>((resolve, reject) => {
            db.ref('/users/' + userId).once('value')
                .then(snapshotUser => {
                    const user = snapshotUser.val();
                    resolve(user.tokenDevice);
                })
                .catch(reason => {
                    console.error(new Error(reason));
                    reject(reason);
                });
        });
        promiseArray.push(promesse);
    }
    return Promise.all(promiseArray);
}