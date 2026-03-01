// Mock vide pour @techstark/opencv-js
// Ce module n'est pas disponible côté client (navigateur).
// Il est uniquement utilisé dans document-parser.ts avec des guards conditionnels.
// En production serveur, installer le vrai package : npm install @techstark/opencv-js

const opencvMock = {};
module.exports = opencvMock;
