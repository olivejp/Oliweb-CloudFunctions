import MessagingDevicesResponse = admin.messaging.MessagingDevicesResponse;
import ServerValue = admin.database.ServerValue;

const functions = require('firebase-functions');
import * as admin from "firebase-admin";

try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export function getServerTimestamp(): Promise<number> {
    return new Promise((resolve, reject) => {
        db.ref('timestamp').child('now').set(ServerValue.TIMESTAMP, function (error) {
            if (error) {
                reject(error);
            } else {
                db.ref('timestamp').child('now').once('value').then(
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
 * @param tokens: string | string[]
 * @param title: string
 * @param body: string
 * @param tag: string
 * @param data: any
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