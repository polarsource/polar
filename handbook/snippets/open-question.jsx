export const OpenQuestion = ({ children }) => {
  return (
    <Callout icon="circle-question" color="#FFC107">
      <p>
        <strong>Open Question</strong>
      </p>
      {children}
    </Callout>
  );
};
