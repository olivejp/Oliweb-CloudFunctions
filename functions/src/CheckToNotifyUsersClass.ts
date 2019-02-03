import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import {
    daysInMilliseconds,
    DOMAIN_CLOUD_FUNCTION,
    getParams,
    getServerTimestamp,
    getTokens, PARAM_SANS_PHOTO_NB_JOUR_AP_RELANCE, PARAM_SANS_PHOTO_NB_JOUR_AV_RELANCE,
    sendNotification
} from "./Utility";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const db = admin.database();

export default class CheckToNotifyUserClass {

    public static checkAllAnnonceFunction: HttpsFunction = functions.https.onRequest(async (req, res) => {
            try {
                // Get the timestamp from the server
                const serverTimestamp = await getServerTimestamp();

                await CheckToNotifyUserClass.getAnnoncesWithoutPhotos(serverTimestamp)
                    .then(nbNotificationSend => {
                        console.log('Tout s\'est bien passé : OK - Nb notifications send => ' + nbNotificationSend);
                        res.status(200).send('OK');
                    })
                    .catch(reason => {
                        console.error(reason);
                        res.status(500).send('FAIL');
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('FAIL');
            }
        }
    );

    // Parcourt de la liste des annonces pour voir celles qu'on va relancer
    private static getAnnoncesWithoutPhotos(timestampServer: number): Promise<number> {
        return new Promise((resolve, reject) => {
            db.ref('/annonces/').once('value')
                .then(async datasnapshot => {
                    try {

                        // Récupération du nombre de jour qu'on est censé attendre avant de lancer la notification
                        // Si on avait déjà relancé la personne, on la relancera dans un délai un peu plus long pour ne pas la spammer.
                        const nbJourAvantRelance = await getParams(DOMAIN_CLOUD_FUNCTION, PARAM_SANS_PHOTO_NB_JOUR_AV_RELANCE);
                        const nbJourApresRelance = await getParams(DOMAIN_CLOUD_FUNCTION, PARAM_SANS_PHOTO_NB_JOUR_AP_RELANCE);

                        console.log('nbJourAvantRelance => ' + nbJourAvantRelance);
                        console.log('nbJourApresRelance => ' + nbJourApresRelance);

                        let nbNotificationSend: number = 0;

                        datasnapshot.forEach(childDatasnapshot => {
                            // Récupération de la liste des annonces
                            const annonce = childDatasnapshot.val();

                            // Parcourt de toutes les annonces
                            // On veut pouvoir relancer les utilisateurs qui ne mettent pas de photo dans leurs annonces
                            this.checkDateAndSendNotificationIfNeeded(annonce, timestampServer, nbJourAvantRelance, nbJourApresRelance)
                                .then(notificationHasBeenSaved => {
                                    if (notificationHasBeenSaved) {
                                        nbNotificationSend++;
                                    }
                                })
                                .catch(reason => console.error(reason));

                            return false;
                        });

                        resolve(nbNotificationSend);
                    } catch (e) {
                        reject(e);
                    }
                })
                .catch(reason => {
                    console.error(new Error(reason));
                    reject(reason);
                });
        });
    }

    // Va rechercher la liste des annonces postées sans photos
    private static checkDateAndSendNotificationIfNeeded(annonce: any, timestampServer: number, nbJourAvantRelance: number, nbJourApresRelance: number): Promise<boolean> {
        return new Promise((resolve, reject) => {

            // Si on a déjà une date de relance c'est elle qu'on va regarder, sinon ça sera la date de publication
            const isDateRelanceDefined = (annonce.dateRelance !== undefined && annonce.dateRelance && annonce.dateRelance > 0);
            const dateAComparer = (isDateRelanceDefined) ? annonce.dateRelance : annonce.datePublication;

            console.log('Je check l annonce ' + annonce.uuid + ' avec isDateRelanceDefined = ' + isDateRelanceDefined + ' et dateAComparer = ' + dateAComparer);

            // Si l'annonce n'a pas de photos je vais regarder depuis quand elle a été postée
            if (!annonce.photos || annonce.photos.size == 0) {

                console.log('Je suis dans une annonce sans photo ' + annonce.uuid);

                // Si la date à comparer est supérieure à 3 ou 10 jours
                const delay: number = daysInMilliseconds((isDateRelanceDefined) ? nbJourApresRelance : nbJourAvantRelance);
                const difference: number = timestampServer - dateAComparer;

                console.log('Voilà le délai calculé : ' + delay);
                console.log('Et voilà la différence calculée : ' + difference);

                if (difference > delay) {
                    const uuidUser: string = annonce.utilisateur.uuid;

                    console.log('Annonce UID sans photos = ' + annonce.uuid);

                    // Chaining des Promises
                    getTokens(new Array(uuidUser))
                        .then(arrayTokens => {
                            const tag = "without_photo_user_" + uuidUser + "_annonce_" + annonce.uuid + "_timestamp_" + timestampServer;

                            const data = {
                                KEY_ACTION: 'NOTIF_TO_ADD_PHOTO',
                                KEY_UID_AUTHOR: annonce.utilisateur.uuid,
                                KEY_UID_ANNONCE: annonce.uuid
                            };

                            return sendNotification(arrayTokens, "Vendez efficacement", "Ajouter des photos à votre annonce peut attirer d'avantage d'acheteur", tag, data);
                        })
                        .then(messagingDeviceResponse => {
                            console.log("Relance faite au user " + uuidUser + " pour l'annonce " + annonce.uuid);
                            return db.ref('/annonces/').child(annonce.uuid).child('dateRelance').set(timestampServer);
                        })
                        .then(useless => {
                            console.log('Annonce ' + annonce.uuid + ' a une nouvelle date de relance');
                            resolve(true);
                        })
                        .catch(reason => {
                            console.error(new Error(reason));
                            reject(reason);
                        });
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    }
}
