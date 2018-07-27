const functions = require('firebase-functions');
import * as admin from "firebase-admin";
import ServerValue = admin.database.ServerValue;

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